import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const S3 = {
  copyBoilerplate: async ({
    boilerplate,
    destinationPath,
  }: {
    boilerplate: string;
    destinationPath: string;
  }): Promise<Record<string, string>> => {
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

      const fileVersions: Record<string, string> = {};

      // Copy each object to the new location
      const copyPromises = Contents.map(async (object) => {
        if (!object.Key) return;

        const newKey = object.Key.replace(boilerplate, destinationPath);

        const result = await s3Client.send(
          new CopyObjectCommand({
            Bucket: "weldr-projects",
            CopySource: `weldr-boilerplates/${object.Key}`,
            Key: newKey,
          }),
        );

        if (result.VersionId) {
          fileVersions[newKey] = result.VersionId;
        }
      });

      await Promise.all(copyPromises);
      return fileVersions;
    } catch (error) {
      console.error(`[S3:copyBoilerplate] Error copying directory: ${error}`);
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

      console.log(`[S3:readFile:${projectId}] Reading file ${path}`);

      const response = await s3Client.send(command);
      const content = await response.Body?.transformToString();
      return content;
    } catch (error) {
      console.error(`[S3:readFile:${projectId}] Failed to read file ${path}`);
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

      console.log(`[S3:writeFile:${projectId}] Writing file ${path}`);

      const response = await s3Client.send(command);
      return response.VersionId;
    } catch (error) {
      console.error(`[S3:writeFile:${projectId}] Failed to write file ${path}`);
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
  deleteFile: async ({
    projectId,
    path,
  }: {
    projectId: string;
    path: string;
  }): Promise<string | undefined> => {
    const fullPath = `${projectId}/${path}`;

    try {
      const command = new DeleteObjectCommand({
        Bucket: "weldr-projects",
        Key: fullPath,
      });

      console.log(`[S3:deleteFile:${projectId}] Deleting file ${path}`);

      const response = await s3Client.send(command);
      return response.VersionId;
    } catch (error) {
      console.error(
        `[S3:deleteFile:${projectId}] Failed to delete file ${path} - ${error}`,
      );
      throw new Error(`Failed to delete file ${path} from S3`);
    }
  },
};
