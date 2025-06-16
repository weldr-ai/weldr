import { Fly } from "@weldr/shared/fly";
import type { Attachment, UserMessageRawContent } from "@weldr/shared/types";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = (await request.json()) as {
      projectId: string;
      message: {
        content: UserMessageRawContent;
        attachments: Attachment[];
      };
    };

    let url = "http://localhost:8080";

    if (process.env.NODE_ENV === "production") {
      const devMachineId = await Fly.machine.getDevMachineId({
        projectId: body.projectId,
      });
      url = `http://${devMachineId}.vm.development-app-${body.projectId}.internal:8080`;
    }

    // Create headers object, preserving original headers but updating origin-related ones
    const headers = new Headers();

    // Copy all headers from the original request except origin-related ones
    request.headers.forEach((value, key) => {
      if (!["host", "origin", "referer"].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    // Set the new origin and host for the destination
    headers.set("host", "localhost:8080");
    headers.set("origin", url);
    headers.set("content-type", "application/json");

    // Make the proxy request to the agent service
    const response = await fetch(`${url}/start`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    // Stream the response (response is always a stream)
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "text/plain; charset=utf-8",
        "Cache-Control": response.headers.get("Cache-Control") || "no-cache",
        "Keep-Alive": response.headers.get("Keep-Alive") || "timeout=5",
        "Transfer-Encoding":
          response.headers.get("Transfer-Encoding") || "chunked",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
