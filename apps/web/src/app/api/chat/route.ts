import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@weldr/auth";
import { and, db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import type { Attachment, UserMessage } from "@weldr/shared/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    projectId: string;
    branchId: string;
    message: {
      content: UserMessage["content"];
      attachments: Attachment[];
    };
  };

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, body.projectId),
        eq(projects.userId, session.user.id),
      ),
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (process.env.NODE_ENV === "production") {
      const appName = `app-development-${body.projectId}`;

      return new NextResponse(null, {
        status: 200,
        headers: {
          "fly-replay": `app=${appName}`,
        },
      });
    }

    // Development: use localhost
    const url = "http://localhost:8080";

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
    headers.set("origin", "http://localhost:8080");
    headers.set("content-type", "application/json");

    const response = await fetch(`${url}/trigger`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
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
