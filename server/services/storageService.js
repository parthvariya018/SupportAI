/**
 * services/storageService.js
 *
 * Thin wrapper around the AWS SDK v3 S3 client.
 * Compatible with AWS S3 and any S3-compatible provider (Cloudflare R2, MinIO, etc.)
 *
 * Exported functions:
 *   uploadToStorage(buffer, key, mimetype)  → { key, url }
 *   deleteFromStorage(key)                  → void
 *   isStorageConfigured()                   → boolean
 *
 * When storage is NOT configured (dev without credentials) every function
 * is a no-op so the rest of the app degrades gracefully.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// ── Detect configuration ──────────────────────────────────────────────────────
const isStorageConfigured = () =>
  !!(process.env.STORAGE_ENDPOINT &&
     process.env.STORAGE_ACCESS_KEY_ID &&
     process.env.STORAGE_SECRET_ACCESS_KEY &&
     process.env.STORAGE_BUCKET);

// ── Lazy S3 client — only instantiated when credentials are present ────────────
let _client = null;
function getClient() {
  if (_client) return _client;
  if (!isStorageConfigured()) {
    throw new Error(
      'Cloud storage is not configured. ' +
      'Set STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, ' +
      'and STORAGE_BUCKET in your .env file.'
    );
  }
  _client = new S3Client({
    region:   process.env.STORAGE_REGION || 'auto',
    endpoint: process.env.STORAGE_ENDPOINT,
    credentials: {
      accessKeyId:     process.env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    },
    // Required for path-style URLs (Cloudflare R2, MinIO)
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
  });
  return _client;
}

// ── Key generator ─────────────────────────────────────────────────────────────
/**
 * buildKey(companyId, originalName) → string
 *
 * Produces a collision-free, path-traversal-safe object key:
 *   documents/<companyId>/<uuid>-<sanitized-name>
 *
 * The UUID prefix guarantees uniqueness even if two companies upload
 * a file with the same name at the same time.
 */
function buildKey(companyId, originalName) {
  const ext  = path.extname(originalName).toLowerCase() || '.pdf';
  const base = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // safe chars only
    .slice(0, 80);                       // cap length
  return `documents/${companyId}/${uuidv4()}-${base}${ext}`;
}

// ── Public URL builder ────────────────────────────────────────────────────────
/**
 * Returns the public URL for an object key.
 * Uses STORAGE_PUBLIC_URL when set (e.g. a Cloudflare R2 custom domain or CDN).
 * Falls back to constructing the URL from endpoint + bucket + key.
 */
function buildPublicUrl(key) {
  const base = process.env.STORAGE_PUBLIC_URL
    ? process.env.STORAGE_PUBLIC_URL.replace(/\/$/, '')
    : `${process.env.STORAGE_ENDPOINT.replace(/\/$/, '')}/${process.env.STORAGE_BUCKET}`;
  return `${base}/${key}`;
}

// ── Upload ────────────────────────────────────────────────────────────────────
/**
 * uploadToStorage(buffer, companyId, sanitizedName, mimetype)
 *
 * Streams the buffer directly to S3/R2 — never touches the local filesystem.
 * Returns { key, url } on success.
 * Throws on failure — caller is responsible for not saving the DB record.
 */
async function uploadToStorage(buffer, companyId, sanitizedName, mimetype = 'application/pdf') {
  const client = getClient();
  const key    = buildKey(companyId, sanitizedName);

  await client.send(new PutObjectCommand({
    Bucket:      process.env.STORAGE_BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: mimetype,
    ContentLength: buffer.length,
    // Metadata stored alongside the object for debugging / auditing
    Metadata: {
      originalName: sanitizedName,
      companyId:    String(companyId),
    },
  }));

  return { key, url: buildPublicUrl(key) };
}

// ── Delete ────────────────────────────────────────────────────────────────────
/**
 * deleteFromStorage(key)
 *
 * Deletes the object from S3/R2.
 * Silently ignores NoSuchKey — the object may have already been deleted.
 * Throws on any other error so the caller can log it.
 */
async function deleteFromStorage(key) {
  if (!key) return;
  if (!isStorageConfigured()) return;

  const client = getClient();
  try {
    await client.send(new DeleteObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key:    key,
    }));
  } catch (err) {
    // NoSuchKey is not an error — object was already gone
    if (err?.Code === 'NoSuchKey' || err?.name === 'NoSuchKey') return;
    throw err;
  }
}

module.exports = { uploadToStorage, deleteFromStorage, isStorageConfigured, buildKey };
