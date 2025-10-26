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
  createBucket as tigrisCreateBucket,
  createBucketSnapshot as tigrisCreateBucketSnapshot,
  getPresignedUrl as tigrisGetPresignedUrl,
  removeBucket as tigrisRemoveBucket,
} from "@tigrisdata/storage";

import { Logger } from "./logger";

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

const iamClient = new IAMClient({
  region: "auto",
  endpoint: process.env.TIGRIS_IAM_ENDPOINT ?? "https://iam.storage.dev",
  credentials: {
    accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY ?? "",
  },
});

const tigrisConfig = {
  accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY ?? "",
};

async function createBucket(bucketName: string): Promise<void> {
  try {
    const response = await tigrisCreateBucket(bucketName, {
      enableSnapshot: true,
      config: tigrisConfig,
    });

    if (response.error) {
      throw response.error;
    }

    Logger.info("Create bucket response", {
      bucketName,
      response: response.data,
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
    const response = await tigrisRemoveBucket(bucketName, {
      config: tigrisConfig,
    });

    if (response.error) {
      // Check if it's a 404 error (bucket not found)
      const errorMessage = response.error.message || "";
      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        return;
      }
      throw response.error;
    }

    Logger.info("Delete bucket response", {
      bucketName,
      response: response.data,
    });
  } catch (error) {
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

async function createProjectBucket(bucketName: string): Promise<Credentials> {
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

async function deleteProjectBucket(bucketName: string): Promise<void> {
  await Promise.all([
    deleteAccessKey(bucketName),
    deleteBucket(bucketName),
    deletePolicy(bucketName),
  ]);
}

async function forkBucket(
  sourceBucket: string,
  forkBucket: string,
): Promise<void> {
  const result = await tigrisCreateBucket(forkBucket, {
    sourceBucketName: sourceBucket,
    enableSnapshot: true,
    config: tigrisConfig,
  });

  if (result.error) {
    throw new Error(`Failed to fork bucket: ${result.error}`);
  }
}

async function getObjectSignedUrl(
  bucketName: string,
  objectKey: string,
  expiresIn = 3600,
): Promise<string> {
  const response = await tigrisGetPresignedUrl(objectKey, {
    operation: "get",
    expiresIn,
    config: {
      ...tigrisConfig,
      bucket: bucketName,
    },
  });

  if (response.error) {
    Logger.error("Get presigned URL error", {
      bucketName,
      objectKey,
      error: response.error,
    });
    throw response.error;
  }

  return response.data?.url ?? "";
}

async function createSnapshot(
  bucketName: string,
  snapshotName: string,
): Promise<string> {
  try {
    const response = await tigrisCreateBucketSnapshot(bucketName, {
      name: snapshotName,
      config: tigrisConfig,
    });

    if (response.error) {
      Logger.error("Create snapshot error", {
        bucketName,
        snapshotName,
        error: response.error,
      });
      throw response.error;
    }

    Logger.info("Snapshot created", {
      bucketName,
      snapshotName,
      version: response.data.snapshotVersion,
    });

    return response.data.snapshotVersion;
  } catch (error) {
    Logger.error("Create snapshot error", {
      bucketName,
      snapshotName,
      error,
    });
    throw error;
  }
}

export const Tigris = {
  bucket: {
    create: createProjectBucket,
    delete: deleteProjectBucket,
    fork: forkBucket,
    snapshot: {
      create: createSnapshot,
    },
  },
  object: {
    getSignedUrl: getObjectSignedUrl,
  },
};
