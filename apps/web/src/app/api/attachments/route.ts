import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@weldr/auth";
import { Logger } from "@weldr/shared/logger";
import { nanoid } from "@weldr/shared/nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

const BUCKET_NAME = process.env.GENERAL_BUCKET;

const attachmentSchema = z.object({
  chatId: z.string().min(1, { message: "Chat ID is required" }),
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    .refine(
      (file) =>
        ["image/jpeg", "image/png", "application/pdf"].includes(file.type),
      {
        message: "File type should be JPEG, PNG, or PDF",
      },
    ),
});

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.TIGRIS_ENDPOINT_URL ?? "https://t3.storage.dev",
  forcePathStyle: false,
  credentials: {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;
    const chatId = formData.get("chatId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedAttachment = attachmentSchema.safeParse({
      file,
      chatId,
    });

    if (!validatedAttachment.success) {
      const errorMessage = validatedAttachment.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const fileBuffer = await file.arrayBuffer();

    try {
      const attachmentId = nanoid();

      const key = `attachments/${validatedAttachment.data.chatId}/${attachmentId}.${file.type.split("/")[1]}`;

      const upload = new Upload({
        params: {
          Bucket: BUCKET_NAME,
          Key: key,
          Body: new Uint8Array(fileBuffer),
        },
        client: s3Client,
        queueSize: 3,
      });

      upload.on("httpUploadProgress", (progress) => {
        Logger.info("Upload progress", {
          progress,
          chatId: validatedAttachment.data.chatId,
        });
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

      return NextResponse.json({
        id: attachmentId,
        name: filename,
        key,
        contentType: file.type,
        size: file.size,
        url: imageUrl,
      });
    } catch (error) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}

const deleteAttachmentSchema = z.object({
  filename: z.string(),
});

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = deleteAttachmentSchema.safeParse(await request.json());

  if (!validated.success) {
    return NextResponse.json(
      { error: "Filename is required" },
      { status: 400 },
    );
  }

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: validated.data.filename,
      }),
    );

    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 },
    );
  }
}
