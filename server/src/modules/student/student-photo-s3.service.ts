import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const PRESIGN_EXPIRES_SEC = 300;
const MAX_BYTES = 5 * 1024 * 1024;

function getBucketConfig(): { region: string; bucket: string } {
  const region = process.env.AWS_REGION?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  if (!region || !bucket) {
    throw new Error(
      "Photo upload is not configured. Set AWS_REGION and AWS_S3_BUCKET.",
    );
  }
  return { region, bucket };
}

let cachedClient: { region: string; client: S3Client } | null = null;

function getClient(region: string): S3Client {
  if (!cachedClient || cachedClient.region !== region) {
    cachedClient = {
      region,
      client: new S3Client({
        region,
        /**
         * Default SDK behavior (`WHEN_SUPPORTED`) adds CRC32 query params to presigned PUT
         * URLs. Browser `fetch` uploads then need matching headers and are harder to align with
         * CORS. `WHEN_REQUIRED` keeps presigned URLs minimal (Content-Type + body only).
         */
        requestChecksumCalculation: "WHEN_REQUIRED",
      }),
    };
  }
  return cachedClient.client;
}

/** Encode each path segment for use in a public object URL. */
function encodeKeyForUrl(key: string): string {
  return key.split("/").map((s) => encodeURIComponent(s)).join("/");
}

function buildPublicUrl(bucket: string, region: string, key: string): string {
  const base = process.env.AWS_S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const encoded = encodeKeyForUrl(key);
  if (base) {
    return `${base}/${encoded}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${encoded}`;
}

export function isStudentPhotoUploadConfigured(): boolean {
  return Boolean(
    process.env.AWS_REGION?.trim() && process.env.AWS_S3_BUCKET?.trim(),
  );
}

export interface PresignStudentPhotoResult {
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
  maxBytes: number;
}

/**
 * Issues a short-lived presigned PUT URL. After upload, the object is readable at `publicUrl`
 * if the bucket/policy (or CloudFront in front of `AWS_S3_PUBLIC_BASE_URL`) allows public GET.
 */
export async function presignStudentPhotoPut(
  tenantId: string,
  studentId: string,
  contentType: string,
): Promise<PresignStudentPhotoResult> {
  const ext = ALLOWED_TYPES.get(contentType);
  if (!ext) {
    throw new Error(
      "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
    );
  }

  const { region, bucket } = getBucketConfig();
  const key = `tenants/${tenantId}/students/${studentId}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(region), command, {
    expiresIn: PRESIGN_EXPIRES_SEC,
  });

  return {
    uploadUrl,
    publicUrl: buildPublicUrl(bucket, region, key),
    expiresIn: PRESIGN_EXPIRES_SEC,
    maxBytes: MAX_BYTES,
  };
}
