import {
  CopyObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  credentials: {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface CopiedFile {
  path: string;
  name: string;
}

export const S3 = {
  copyBoilerplate: async ({
    boilerplate,
    destinationPath,
  }: {
    boilerplate: string;
    destinationPath: string;
  }): Promise<void> => {
    try {
      // List all objects in the source "directory"
      const listCommand = new ListObjectsV2Command({
        Bucket: "weldr-boilerplates",
        Prefix: boilerplate,
      });

      const { Contents } = await s3Client.send(listCommand);

      if (!Contents?.length) {
        throw new Error(`No objects found in source path: ${boilerplate}`);
      }

      const copiedFiles: CopiedFile[] = [];

      // Copy each object to the new location
      const copyPromises = Contents.map((object) => {
        if (!object.Key) return Promise.resolve();

        const newKey = object.Key.replace(boilerplate, destinationPath);
        const fileName = newKey.split("/").pop() || "";

        copiedFiles.push({
          path: newKey,
          name: fileName,
        });

        return s3Client.send(
          new CopyObjectCommand({
            Bucket: "weldr-projects",
            CopySource: `weldr-boilerplates/${object.Key}`,
            Key: newKey,
          }),
        );
      });

      await Promise.all(copyPromises);
    } catch (error) {
      console.error("Error copying directory:", error);
      throw error;
    }
  },
  readFile: async ({
    projectId,
    path,
  }: {
    projectId: string;
    path: string;
  }): Promise<string | undefined> => {
    const fullPath = `${projectId}/${path}`;

    try {
      const command = new GetObjectCommand({
        Bucket: "weldr-projects",
        Key: fullPath,
      });

      console.log("Reading file from S3", {
        path,
        fullPath,
        bucket: "weldr-projects",
      });

      const response = await s3Client.send(command);
      const content = await response.Body?.transformToString();
      return content;
    } catch (error) {
      console.error("Failed to read file from S3", { path, fullPath, error });
      return undefined;
    }
  },
  writeFile: async ({
    projectId,
    path,
    content,
  }: {
    projectId: string;
    path: string;
    content: string;
  }): Promise<string | undefined> => {
    const fullPath = `${projectId}/${path}`;

    try {
      const command = new PutObjectCommand({
        Bucket: "weldr-projects",
        Key: fullPath,
        Body: content,
        ContentType: "text/plain",
      });

      console.log("Writing file to S3", {
        path,
        fullPath,
        bucket: "weldr-projects",
      });

      const response = await s3Client.send(command);
      return response.VersionId;
    } catch (error) {
      console.error("Failed to write file to S3", { path, fullPath, error });
      throw new Error(`Failed to write file ${path} to S3`);
    }
  },
  getAttachmentUrl: async (key: string) => {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: "weldr-chat-attachments",
        Key: key,
      }),
      { expiresIn: 3600 },
    );

    return url;
  },
};
