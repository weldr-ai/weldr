import {
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreatePolicyCommand,
  DeleteAccessKeyCommand,
  DeletePolicyCommand,
  IAMClient,
  ListAccessKeysCommand,
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

async function createBucket(bucketName: string): Promise<void> {
  try {
    const response = await s3Client.send(
      new CreateBucketCommand({
        Bucket: bucketName,
      }),
    );
    Logger.info("Create bucket response", {
      bucketName,
      response,
    });
  } catch (error) {
    Logger.error("Create bucket error", {
      bucketName,
      error,
    });
    throw error;
  }
}

async function deleteBucket(bucketName: string): Promise<void> {
  try {
    const response = await s3Client.send(
      new DeleteBucketCommand({
        Bucket: bucketName,
      }),
    );
    Logger.info("Delete bucket response", {
      bucketName,
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
      bucketName,
      error,
    });
    throw error;
  }
}

function createBucketPolicyDocument(bucketName: string): string {
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "ListObjectsInBucket",
        Effect: "Allow",
        Action: ["s3:ListBucket"],
        Resource: [`arn:aws:s3:::${bucketName}`],
      },
      {
        Sid: "ManageAllObjectsInBucketWildcard",
        Effect: "Allow",
        Action: ["s3:*"],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      },
    ],
  };
  return JSON.stringify(policy);
}

async function createAccessKey(
  bucketName: string,
): Promise<{ accessKeyId: string; secretAccessKey: string }> {
  try {
    const accessKeyResponse = await iamClient.send(
      new CreateAccessKeyCommand({
        UserName: bucketName,
      }),
    );
    Logger.info("Create credentials access key response", {
      bucketName,
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
      bucketName,
      error,
    });
    throw error;
  }
}

async function findAccessKey(bucketName: string): Promise<string | undefined> {
  try {
    const response = await iamClient.send(
      new ListAccessKeysCommand({
        UserName: bucketName,
      }),
    );
    const accessKey = response.AccessKeyMetadata?.[0];
    return accessKey?.AccessKeyId;
  } catch (error) {
    Logger.error("Find access key error", {
      bucketName,
      error,
    });
    return undefined;
  }
}

async function deleteAccessKey(bucketName: string): Promise<Error | undefined> {
  try {
    const accessKeyId = await findAccessKey(bucketName);

    if (!accessKeyId) {
      Logger.info("Access key not found", {
        bucketName,
      });
      return undefined;
    }

    const response = await iamClient.send(
      new DeleteAccessKeyCommand({
        UserName: bucketName,
        AccessKeyId: accessKeyId,
      }),
    );
    Logger.info("Delete access key response", {
      bucketName,
      accessKeyId,
      response,
    });
    return undefined;
  } catch (error) {
    Logger.error("Delete access key error", {
      bucketName,
      error,
    });
    return new Error(
      `Failed to delete access key: ${(error as Error).message}`,
    );
  }
}

async function createPolicy(bucketName: string): Promise<string> {
  try {
    const policyName = `${bucketName}-policy`;
    const policyDocument = createBucketPolicyDocument(bucketName);
    const policyResponse = await iamClient.send(
      new CreatePolicyCommand({
        PolicyName: policyName,
        PolicyDocument: policyDocument,
      }),
    );
    Logger.info("Create credentials policy response", {
      bucketName,
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
      bucketName,
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
  bucketName: string,
): Promise<string | undefined> {
  try {
    const policyName = `${bucketName}-policy`;
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
      bucketName,
      error,
    });
    return undefined;
  }
}

async function deletePolicy(bucketName: string): Promise<Error | undefined> {
  try {
    const policyName = `${bucketName}-policy`;
    const policyArn = await findPolicyByName(bucketName);

    if (!policyArn) {
      Logger.info("Policy not found", {
        policyName,
        bucketName,
      });
      return undefined;
    }

    const response = await iamClient.send(
      new DeletePolicyCommand({
        PolicyArn: policyArn,
      }),
    );
    Logger.info("Delete policy response", {
      bucketName,
      response,
    });
    return undefined;
  } catch (error) {
    Logger.error("Delete policy error", {
      bucketName,
      error,
    });
    return new Error(`Failed to delete policy: ${(error as Error).message}`);
  }
}

async function createCredentials(bucketName: string): Promise<Credentials> {
  try {
    const accessKey = await createAccessKey(bucketName);

    const policyArn = await createPolicy(bucketName);

    await attachPolicyToUser(accessKey.accessKeyId, policyArn);

    return {
      accessKeyId: accessKey.accessKeyId,
      secretAccessKey: accessKey.secretAccessKey,
    };
  } catch (error) {
    Logger.error("Create credentials error", {
      bucketName,
      error,
    });
    throw error;
  }
}

async function createTigrisBucket(bucketName: string): Promise<Credentials> {
  try {
    await createBucket(bucketName);
    try {
      return await createCredentials(bucketName);
    } catch (error) {
      Logger.error("Error creating credentials, cleaning up bucket", {
        bucketName,
        error,
      });
      await deleteBucket(bucketName);
      throw error;
    }
  } catch (error) {
    Logger.error("Create Tigris bucket error", {
      bucketName,
      error,
    });
    throw new Error("Failed to set up Tigris bucket");
  }
}

async function deleteTigrisBucket(bucketName: string): Promise<void> {
  await Promise.all([
    deleteAccessKey(bucketName),
    deleteBucket(bucketName),
    deletePolicy(bucketName),
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
