import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createPythonJob } from "~/lib/yaml-generator";

export async function POST(req: NextRequest) {
  const data = (await req.json()) as {
    name: string;
    inputs: { name: string; value: string }[];
    functionCode: string;
  };

  const pythonJob = createPythonJob(data.name, data.inputs, data.functionCode);

  const res = await fetch("http://127.0.0.1:8000/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "text/yaml",
    },
    body: pythonJob,
  });

  if (!res.ok) {
    const error = await res.text();
    return new Response(error, {
      status: 500,
    });
  }

  const job = (await res.json()) as {
    id: string;
  };

  return NextResponse.json({ ...job });
}
