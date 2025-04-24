import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import JSZip from "jszip";

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
    versionId,
  }: {
    projectId: string;
    path: string;
    versionId?: string;
  }): Promise<string | undefined> => {
    const fullPath = `${projectId}/${path.startsWith("/") ? path.slice(1) : path}`;

    try {
      const command = new GetObjectCommand({
        Bucket: "weldr-projects",
        Key: fullPath,
        VersionId: versionId,
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
    const fullPath = `${projectId}/${path.startsWith("/") ? path.slice(1) : path}`;

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
  getSignedUrl: async (bucket: string, key: string, expiresIn = 3600) => {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn },
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
  downloadProject: async ({
    projectId,
    projectName,
    files,
  }: {
    projectId: string;
    projectName: string;
    files: {
      path: string;
      versionId?: string;
    }[];
  }): Promise<string> => {
    try {
      // Create a new zip file
      const zip = new JSZip();

      // Download and add each file to the zip
      const downloadPromises = files.map(async (file) => {
        const command = new GetObjectCommand({
          Bucket: "weldr-projects",
          Key: `${projectId}/${file.path.startsWith("/") ? file.path.slice(1) : file.path}`,
          VersionId: file.versionId,
        });

        const response = await s3Client.send(command);
        const content = await response.Body?.transformToString();

        if (content) {
          zip.file(file.path, content);
        }
      });

      await Promise.all(downloadPromises);

      // Generate zip content
      const zipContent = await zip.generateAsync({ type: "nodebuffer" });

      // Calculate expiration time (1 hour from now)
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 1);

      // Upload zip file to S3 with expiration
      const zipKey = `temp-downloads/${projectId}/${projectName}.zip`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: "weldr-controlled-general",
          Key: zipKey,
          Body: zipContent,
          ContentType: "application/zip",
          Expires: expirationDate,
          Metadata: {
            temporary: "true",
          },
        }),
      );

      // Generate signed URL for download (matching the expiration time)
      const signedUrl = await S3.getSignedUrl(
        "weldr-controlled-general",
        zipKey,
        3600,
      );
      return signedUrl;
    } catch (error) {
      console.error(
        `[S3:downloadProject] Error downloading project ${projectId}: ${error}`,
      );
      throw error;
    }
  },
};
