import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@weldr/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

// Use Blob instead of File since File is not available in Node.js environment
const attachmentSchema = z.object({
  chatId: z.string().min(1, { message: "Chat ID is required" }),
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    // Update the file type based on the kind of files you want to accept
    .refine(
      (file) =>
        ["image/jpeg", "image/png", "application/pdf"].includes(file.type),
      {
        message: "File type should be JPEG, PNG, or PDF",
      },
    ),
});

const BUCKET_NAME = "weldr-chat-attachments";

const s3Client = new S3Client({
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  region: process.env.AWS_REGION!,
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  endpoint: process.env.AWS_ENDPOINT_URL_S3!,
  credentials: {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
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
      const attachmentId = createId();

      const key = `${session.user.id}/${validatedAttachment.data.chatId}/${attachmentId}.${file.type.split("/")[1]}`;

      // Create an upload object to upload the file to the bucket
      const upload = new Upload({
        params: {
          Bucket: BUCKET_NAME,
          Key: key,
          Body: new Uint8Array(fileBuffer),
        },
        client: s3Client,
        queueSize: 3,
      });

      // Listen for progress events and log them to the console
      upload.on("httpUploadProgress", (progress) => {
        console.log(progress);
      });

      // Execute the upload and wait for it to complete
      await upload.done();

      // Create a signed URL for the uploaded object
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
