"use server";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@weldr/auth";
import { db, eq } from "@weldr/db";
import { versions } from "@weldr/db/schema";
import { headers } from "next/headers";
import { chromium } from "playwright";

const BUCKET_NAME = process.env.GENERAL_BUCKET;

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function takeScreenshot({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const version = await db.query.versions.findFirst({
    where: eq(versions.id, versionId),
  });

  if (!version) {
    throw new Error("Version not found");
  }

  try {
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

    await page.goto(`https://${version.id}.preview.weldr.app`, {
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

    const key = `thumbnails/${projectId}/${versionId}.jpeg`;

    const upload = new Upload({
      params: {
        Bucket: BUCKET_NAME,
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

    const imageUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }),
      { expiresIn: 3600 },
    );

    return imageUrl;
  } catch (error) {
    console.error("Error generating screenshot:", error);
    return null;
  }
}
