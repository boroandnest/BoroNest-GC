// Storage abstraction (P4), S3-compatible backend. Same code, different environment variables.
// Runs when S3_TEST_ENDPOINT points at MinIO / moto / R2, e.g.
//   S3_TEST_ENDPOINT=http://127.0.0.1:5055 S3_TEST_BUCKET=bn-test npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

const endpoint = process.env.S3_TEST_ENDPOINT;
const skip = !endpoint && 'S3_TEST_ENDPOINT not set';

test('S3 backend: put/get/presign/delete with env-only configuration', { skip }, async () => {
  Object.assign(process.env, {
    S3_ENDPOINT: endpoint,
    S3_BUCKET: process.env.S3_TEST_BUCKET || 'bn-test',
    S3_KEY: process.env.S3_TEST_KEY || 'test',
    S3_SECRET: process.env.S3_TEST_SECRET || 'test',
    S3_REGION: process.env.S3_TEST_REGION || 'us-east-1',
    S3_FORCE_PATH_STYLE: 'true'
  });
  const { S3Client, CreateBucketCommand } = await import('@aws-sdk/client-s3');
  const admin = new S3Client({ region: process.env.S3_REGION, endpoint, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_KEY, secretAccessKey: process.env.S3_SECRET } });
  await admin.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET })).catch(e => { if (!/BucketAlready/.test(e.name)) throw e; });

  const storage = await import('./storage.js');
  assert.equal(storage.storageBackend(), 's3');
  const put = await storage.putObject('cois/abc.pdf', Buffer.from('%PDF-1.4 coi'), 'application/pdf');
  assert.deepEqual(put, { key: 'cois/abc.pdf', backend: 's3' });
  assert.equal((await storage.getObject('cois/abc.pdf')).toString(), '%PDF-1.4 coi');

  const url = await storage.getSignedUrl('cois/abc.pdf', { expiresIn: 60, filename: 'coi.pdf' });
  assert.match(url, /X-Amz-Signature=/);
  const signed = await fetch(url);
  assert.equal(signed.status, 200);
  assert.equal(await signed.text(), '%PDF-1.4 coi');

  await storage.deleteObject('cois/abc.pdf');
  await assert.rejects(() => storage.getObject('cois/abc.pdf'));
});
