import {
  CreateBucketCommand,
  GetObjectCommand,
  PutBucketVersioningCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  type Db,
  type InferSelectModel,
  type Tx,
  and,
  db,
  eq,
  inArray,
} from "@weldr/db";
import { type declarations, dependencies } from "@weldr/db/schema";

export async function wouldCreateCycle({
  dependentId,
  dependencyId,
  db: transactionDb = db,
}: {
  dependentId: string;
  dependencyId: string;
  db?: Db | Tx;
}): Promise<boolean> {
  if (dependentId === dependencyId) {
    return true;
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  async function dfs(currentId: string): Promise<boolean> {
    if (currentId === dependentId) {
      return true;
    }

    visited.add(currentId);
    recursionStack.add(currentId);

    const deps = await transactionDb.query.dependencies.findMany({
      where: eq(dependencies.dependentId, currentId),
    });

    for (const dep of deps) {
      const nextId = dep.dependencyId;

      if (!nextId) {
        throw new Error("Dependency version ID is null");
      }

      if (!visited.has(nextId)) {
        if (await dfs(nextId)) {
          return true;
        }
      } else if (recursionStack.has(nextId)) {
        return true;
      }
    }

    recursionStack.delete(currentId);
    return false;
  }

  return await dfs(dependencyId);
}

export async function isDeclarationReady(
  declaration: InferSelectModel<typeof declarations>,
): Promise<boolean> {
  if (!declaration.metadata) {
    return false;
  }
  return true;
}

export async function getDependencyChain(db: Db, declarationIds: string[]) {
  const dependenciesResult = await db.query.dependencies.findMany({
    where: and(
      inArray(dependencies.dependentId, declarationIds),
      inArray(dependencies.dependencyId, declarationIds),
    ),
  });

  const dependencyChain = new Map<
    string,
    {
      id: string;
      type: "smooth";
      source: string;
      target: string;
    }
  >();

  for (const d of dependenciesResult) {
    if (d.dependentId && d.dependencyId) {
      const id = `${d.dependentId}-${d.dependencyId}`;
      dependencyChain.set(id, {
        id,
        type: "smooth",
        source: d.dependentId,
        target: d.dependencyId,
      });
    }
  }

  return Array.from(dependencyChain.values());
}

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

export async function getAttachmentUrl(key: string) {
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }),
    { expiresIn: 3600 },
  );

  return url;
}

export async function createVersionedBucket(bucketName: string) {
  try {
    // Create the bucket
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: bucketName,
      }),
    );

    // Enable versioning on the bucket
    await s3Client.send(
      new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: "Enabled",
        },
      }),
    );

    return true;
  } catch (error) {
    console.error("Error creating versioned bucket:", error);
    throw error;
  }
}
