import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const SIGNED_URL_TTL_SECONDS = 300;

const bucketName = () => process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;

export function isStorageConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    bucketName()
  );
}

let client = null;

function getClient() {
  if (!isStorageConfigured()) {
    throw new Error('El almacenamiento de archivos (R2) no está configurado');
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    });
  }
  return client;
}

export async function uploadObject(key, body, contentType) {
  await getClient().send(new PutObjectCommand({
    Bucket: bucketName(),
    Key: key,
    Body: body,
    ContentType: contentType
  }));
}

export async function getSignedDownloadUrl(key, { fileName, contentType } = {}) {
  const command = new GetObjectCommand({
    Bucket: bucketName(),
    Key: key,
    ResponseContentType: contentType,
    ...(fileName && {
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
    })
  });
  return getSignedUrl(getClient(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

export async function deleteObject(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}
