import type { ChildProcess } from "node:child_process";
import type { AgentRuntimeContext } from "@/mastra";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createStep } from "@mastra/core";
import type { RuntimeContext } from "@mastra/core/runtime-context";
import { chromium } from "playwright";
import { z } from "zod";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL ?? "https://t3.storage.dev",
  forcePathStyle: false,
  credentials: {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const screenshotStep = createStep({
  id: "screenshot-step",
  description: "Take a screenshot of the version",
  inputSchema: z.void(),
  outputSchema: z.void(),
  execute: async ({
    runtimeContext,
  }: {
    runtimeContext: RuntimeContext<AgentRuntimeContext>;
  }) => {
    const project = runtimeContext.get("project");
    const version = runtimeContext.get("version");

    if (!version) {
      throw new Error("Version not found");
    }

    let port = 3000;
    let child: ChildProcess | null = null;

    try {
      // Start the vite dev server on port 3000 to avoid conflicts with port 3000
      console.log("Starting vite dev server on port 3000...");

      const { spawn } = await import("node:child_process");

      child = spawn("npm", ["run", "dev", "--", "--port", "3000"], {
        cwd: "/workspace",
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Wait for the server to start and detect the port
      let serverReady = false;
      let serverOutput = "";
      const maxWaitTime = 30000; // 30 seconds

      // Monitor stdout for port information
      const serverStartPromise = new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Server startup timeout"));
        }, maxWaitTime);

        child?.stdout?.on("data", (data: Buffer) => {
          const output = data.toString();
          serverOutput += output;
          console.log("Vite output:", output);

          // Look for port information in vite output
          const portMatch = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
          if (portMatch?.[1]) {
            port = Number.parseInt(portMatch[1], 10);
            serverReady = true;
            clearTimeout(timeout);
            resolve(port);
          }

          // Also check for the ready message
          if (output.includes("ready in")) {
            if (!serverReady) {
              // If no port was explicitly found, assume default port
              serverReady = true;
              clearTimeout(timeout);
              resolve(port);
            }
          }
        });

        child?.stderr?.on("data", (data: Buffer) => {
          const output = data.toString();
          console.error("Vite error:", output);
          serverOutput += output;

          // Check for port conflict and retry with different port
          if (
            output.includes("EADDRINUSE") ||
            (output.includes("port") && output.includes("already in use"))
          ) {
            // Let vite handle port selection automatically
            console.log(
              "Port conflict detected, vite will select available port",
            );
          }
        });

        child?.on("error", (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Wait for server to be ready
      port = await serverStartPromise;
      console.log(`Vite server ready on port ${port}`);

      // Give the server a moment to fully initialize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const browser = await chromium.launch({
        headless: true,
        args: [
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
          "--no-sandbox",
        ],
      });

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        javaScriptEnabled: true,
      });

      const page = await context.newPage();

      // Set a timeout for the page load
      page.setDefaultTimeout(30000);

      await page.goto(`http://localhost:${port}`, {
        waitUntil: "networkidle",
      });

      // Wait for any lazy-loaded content
      await page.waitForLoadState("networkidle");

      const screenshot = await page.screenshot({
        type: "jpeg",
        quality: 80,
        fullPage: true,
      });

      await browser.close();

      // Stop the vite server
      if (child && !child.killed) {
        console.log("Stopping vite server...");
        child.kill("SIGTERM");

        // Force kill after 5 seconds if SIGTERM doesn't work
        setTimeout(() => {
          if (child && !child.killed) {
            child.kill("SIGKILL");
          }
        }, 5000);
      }

      const key = `thumbnails/${project.id}/${version.id}.jpeg`;

      const upload = new Upload({
        params: {
          Bucket: project.id,
          Key: key,
          Body: screenshot,
        },
        client: s3Client,
        queueSize: 3,
      });

      upload.on("httpUploadProgress", (progress) => {
        console.log(progress);
      });

      await upload.done();

      await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: project.id,
          Key: key,
        }),
        { expiresIn: 3600 },
      );
    } catch (error) {
      console.error("Error generating screenshot:", error);

      // Make sure to clean up the vite process if it's still running
      if (child && !child.killed) {
        console.log("Cleaning up vite server...");
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child && !child.killed) {
            child.kill("SIGKILL");
          }
        }, 5000);
      }

      throw error;
    }
  },
});
