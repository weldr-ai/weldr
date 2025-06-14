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
    console.log(
      `[tigris:${projectId}] Create bucket response: ${JSON.stringify(response, null, 2)}`,
    );
  } catch (error) {
    console.error(
      `[tigris:${projectId}] Create bucket error: ${JSON.stringify(error, null, 2)}`,
    );
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
    console.log(
      `[tigris:${projectId}] Delete bucket response: ${JSON.stringify(response, null, 2)}`,
    );
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode === 404
    ) {
      return;
    }
    console.error(
      `[tigris:${projectId}] Delete bucket error: ${JSON.stringify(error, null, 2)}`,
    );
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
        Action: ["s3:ListObjects", "s3:ListObjectsV2"],
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
    console.log(
      `[tigris:${projectId}] Create credentials access key response: ${JSON.stringify(accessKeyResponse, null, 2)}`,
    );

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
    console.error(
      `[tigris:${projectId}] Create access key error: ${JSON.stringify(error, null, 2)}`,
    );
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
    console.log(
      `[tigris:${projectId}] Delete access key response:`,
      JSON.stringify(response, null, 2),
    );
    return undefined;
  } catch (error) {
    console.error(
      `[tigris:${projectId}] Delete access key error:`,
      JSON.stringify(error, null, 2),
    );
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
    console.log(
      `[tigris:${projectId}] Create credentials policy response: ${JSON.stringify(policyResponse, null, 2)}`,
    );

    if (!policyResponse.Policy?.Arn) {
      throw new Error(
        "Failed to create policy: Missing policy ARN in response",
      );
    }

    return policyResponse.Policy.Arn;
  } catch (error) {
    console.error(
      `[tigris:${projectId}] Create policy error: ${JSON.stringify(error, null, 2)}`,
    );
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
    console.log(`[tigris:${accessKeyId}] Attached policy: ${policyArn}`);
  } catch (error) {
    console.error(
      `[tigris:${accessKeyId}] Attach policy error: ${JSON.stringify(error, null, 2)}`,
    );
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
    console.error(
      `[tigris:${projectId}] Failed to find policy by name:`,
      JSON.stringify(error, null, 2),
    );
    return undefined;
  }
}

async function deletePolicy(projectId: string): Promise<Error | undefined> {
  try {
    const policyName = `${projectId}-policy`;
    const policyArn = await findPolicyByName(projectId);

    if (!policyArn) {
      console.log(`[tigris:${projectId}] Policy not found: ${policyName}`);
      return undefined;
    }

    const response = await iamClient.send(
      new DeletePolicyCommand({
        PolicyArn: policyArn,
      }),
    );
    console.log(
      `[tigris:${projectId}] Delete policy response:`,
      JSON.stringify(response, null, 2),
    );
    return undefined;
  } catch (error) {
    console.error(
      `[tigris:${projectId}] Delete policy error:`,
      JSON.stringify(error, null, 2),
    );
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
    console.error(
      `[tigris:${projectId}] Create credentials error: ${JSON.stringify(error, null, 2)}`,
    );
    throw error;
  }
}

async function createTigrisBucket(projectId: string): Promise<Credentials> {
  try {
    await createBucket(projectId);
    try {
      return await createCredentials(projectId);
    } catch (error) {
      console.error(
        `[tigris:${projectId}] Error creating credentials, cleaning up bucket:`,
        JSON.stringify(error, null, 2),
      );
      await deleteBucket(projectId);
      throw error;
    }
  } catch (error) {
    console.error(
      `[tigris:${projectId}] Create Tigris bucket error:`,
      JSON.stringify(error, null, 2),
    );
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
