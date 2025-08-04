import {
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreatePolicyCommand,
  DeleteAccessKeyCommand,
  DeletePolicyCommand,
  IAMClient,
  ListPoliciesCommand,
} from "@aws-sdk/client-iam";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { Logger } from "./logger";

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.TIGRIS_ENDPOINT_URL ?? "https://t3.storage.dev",
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY ?? "",
  },
});

const iamClient = new IAMClient({
  region: "auto",
  endpoint: process.env.TIGRIS_IAM_ENDPOINT ?? "https://iam.storage.dev",
  credentials: {
    accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY ?? "",
  },
});

async function createBucket(projectId: string): Promise<void> {
  try {
    const response = await s3Client.send(
      new CreateBucketCommand({
        Bucket: projectId,
      }),
    );
    Logger.info("Create bucket response", {
      projectId,
      response,
    });
  } catch (error) {
    Logger.error("Create bucket error", {
      projectId,
      error,
    });
    throw error;
  }
}

async function deleteBucket(projectId: string): Promise<void> {
  try {
    const response = await s3Client.send(
      new DeleteBucketCommand({
        Bucket: projectId,
      }),
    );
    Logger.info("Delete bucket response", {
      projectId,
      response,
    });
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode === 404
    ) {
      return;
    }
    Logger.error("Delete bucket error", {
      projectId,
      error,
    });
    throw error;
  }
}

function createBucketPolicyDocument(projectId: string): string {
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "ListObjectsInBucket",
        Effect: "Allow",
        Action: ["s3:ListBucket"],
        Resource: [`arn:aws:s3:::${projectId}`],
      },
      {
        Sid: "ManageAllObjectsInBucketWildcard",
        Effect: "Allow",
        Action: ["s3:*"],
        Resource: [`arn:aws:s3:::${projectId}/*`],
      },
    ],
  };
  return JSON.stringify(policy);
}

async function createAccessKey(
  projectId: string,
): Promise<{ accessKeyId: string; secretAccessKey: string }> {
  try {
    const accessKeyResponse = await iamClient.send(
      new CreateAccessKeyCommand({
        UserName: projectId,
      }),
    );
    Logger.info("Create credentials access key response", {
      projectId,
      accessKeyResponse,
    });

    if (
      !accessKeyResponse.AccessKey?.AccessKeyId ||
      !accessKeyResponse.AccessKey?.SecretAccessKey
    ) {
      throw new Error("Failed to create access key");
    }

    return {
      accessKeyId: accessKeyResponse.AccessKey.AccessKeyId,
      secretAccessKey: accessKeyResponse.AccessKey.SecretAccessKey,
    };
  } catch (error) {
    Logger.error("Create access key error", {
      projectId,
      error,
    });
    throw error;
  }
}

async function deleteAccessKey(projectId: string): Promise<Error | undefined> {
  try {
    const response = await iamClient.send(
      new DeleteAccessKeyCommand({
        UserName: projectId,
        AccessKeyId: projectId,
      }),
    );
    Logger.info("Delete access key response", {
      projectId,
      response,
    });
    return undefined;
  } catch (error) {
    Logger.error("Delete access key error", {
      projectId,
      error,
    });
    return new Error(
      `Failed to delete access key: ${(error as Error).message}`,
    );
  }
}

async function createPolicy(projectId: string): Promise<string> {
  try {
    const policyName = `${projectId}-policy`;
    const policyDocument = createBucketPolicyDocument(projectId);
    const policyResponse = await iamClient.send(
      new CreatePolicyCommand({
        PolicyName: policyName,
        PolicyDocument: policyDocument,
      }),
    );
    Logger.info("Create credentials policy response", {
      projectId,
      policyResponse,
    });

    if (!policyResponse.Policy?.Arn) {
      throw new Error(
        "Failed to create policy: Missing policy ARN in response",
      );
    }

    return policyResponse.Policy.Arn;
  } catch (error) {
    Logger.error("Create policy error", {
      projectId,
      error,
    });
    throw error;
  }
}

async function attachPolicyToUser(
  accessKeyId: string,
  policyArn: string,
): Promise<void> {
  try {
    await iamClient.send(
      new AttachUserPolicyCommand({
        UserName: accessKeyId,
        PolicyArn: policyArn,
      }),
    );
    Logger.info("Attached policy", {
      accessKeyId,
      policyArn,
    });
  } catch (error) {
    Logger.error("Attach policy error", {
      accessKeyId,
      policyArn,
      error,
    });
    throw error;
  }
}

async function findPolicyByName(
  projectId: string,
): Promise<string | undefined> {
  try {
    const policyName = `${projectId}-policy`;
    const listPoliciesResponse = await iamClient.send(
      new ListPoliciesCommand({
        Scope: "Local",
        MaxItems: 1000,
      }),
    );

    const policy = listPoliciesResponse.Policies?.find(
      (p) => p.PolicyName === policyName,
    );
    return policy?.Arn;
  } catch (error) {
    Logger.error("Failed to find policy by name", {
      projectId,
      error,
    });
    return undefined;
  }
}

async function deletePolicy(projectId: string): Promise<Error | undefined> {
  try {
    const policyName = `${projectId}-policy`;
    const policyArn = await findPolicyByName(projectId);

    if (!policyArn) {
      Logger.info("Policy not found", {
        policyName,
        projectId,
      });
      return undefined;
    }

    const response = await iamClient.send(
      new DeletePolicyCommand({
        PolicyArn: policyArn,
      }),
    );
    Logger.info("Delete policy response", {
      projectId,
      response,
    });
    return undefined;
  } catch (error) {
    Logger.error("Delete policy error", {
      projectId,
      error,
    });
    return new Error(`Failed to delete policy: ${(error as Error).message}`);
  }
}

async function createCredentials(projectId: string): Promise<Credentials> {
  try {
    const accessKey = await createAccessKey(projectId);

    const policyArn = await createPolicy(projectId);

    await attachPolicyToUser(accessKey.accessKeyId, policyArn);

    return {
      accessKeyId: accessKey.accessKeyId,
      secretAccessKey: accessKey.secretAccessKey,
    };
  } catch (error) {
    Logger.error("Create credentials error", {
      projectId,
      error,
    });
    throw error;
  }
}

async function createTigrisBucket(projectId: string): Promise<Credentials> {
  try {
    await createBucket(projectId);
    try {
      return await createCredentials(projectId);
    } catch (error) {
      Logger.error("Error creating credentials, cleaning up bucket", {
        projectId,
        error,
      });
      await deleteBucket(projectId);
      throw error;
    }
  } catch (error) {
    Logger.error("Create Tigris bucket error", {
      projectId,
      error,
    });
    throw new Error("Failed to set up Tigris bucket");
  }
}

async function deleteTigrisBucket(projectId: string): Promise<void> {
  await Promise.all([
    deleteBucket(projectId),
    deletePolicy(projectId),
    deleteAccessKey(projectId),
  ]);
}

async function getObjectSignedUrl(
  bucket: string,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn },
  );
  return url;
}

export const Tigris = {
  bucket: {
    create: createTigrisBucket,
    delete: deleteTigrisBucket,
  },
  object: {
    getSignedUrl: getObjectSignedUrl,
  },
};
