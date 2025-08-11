import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@weldr/auth";
import { and, db, eq } from "@weldr/db";
import { projects } from "@weldr/db/schema";
import { Fly } from "@weldr/shared/fly";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const { projectId } = await params;

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.userId, session.user.id),
      ),
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let url = "http://localhost:8080";

    if (process.env.NODE_ENV === "production") {
      const devMachineId = await Fly.machine.getDevMachineId({
        projectId,
      });
      url = `http://${devMachineId}.vm.development-app-${projectId}.internal:8080`;
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

    // Check for lastEventId in query params and set as Last-Event-ID header
    const { searchParams } = new URL(request.url);
    const lastEventId = searchParams.get("lastEventId");
    if (lastEventId) {
      headers.set("Last-Event-ID", lastEventId);
    }

    // Make the proxy request to the agent service
    const response = await fetch(`${url}/stream/${projectId}`, {
      method: "GET",
      headers,
    });

    // Stream the SSE response
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control, Last-Event-ID",
        "Access-Control-Expose-Headers": "Last-Event-ID",
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
