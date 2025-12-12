import { AppStoreConfig } from './types';

/**
 * App Store Connect API Configuration (reads from env for security)
 *
 * Required envs:
 *   APPSTORE_ISSUER_ID
 *   APPSTORE_KEY_ID
 *   APPSTORE_PRIVATE_KEY  (can contain literal \n; will be normalized)
 *
 * Optional:
 *   APPSTORE_VENDOR_NUMBER
 */

const envIssuerId = process.env.APPSTORE_ISSUER_ID;
const envKeyId = process.env.APPSTORE_KEY_ID;
// Normalize private key: support \n escaping from env
const rawPk = process.env.APPSTORE_PRIVATE_KEY;
const envPrivateKey = rawPk ? rawPk.replace(/\\n/g, '\n') : undefined;

// Validate presence to avoid silent fallback to placeholders
if (!envIssuerId || !envKeyId || !envPrivateKey) {
  throw new Error('Missing App Store credentials. Please set APPSTORE_ISSUER_ID, APPSTORE_KEY_ID, APPSTORE_PRIVATE_KEY.');
}

// Basic sanity check for PEM format
if (!envPrivateKey.includes('BEGIN PRIVATE KEY') || !envPrivateKey.includes('END PRIVATE KEY')) {
  throw new Error('APPSTORE_PRIVATE_KEY is not a valid PEM (missing BEGIN/END headers).');
}

export const appStoreConfig: AppStoreConfig = {
  issuerId: envIssuerId,
  keyId: envKeyId,
  privateKey: envPrivateKey,
  vendorNumber: process.env.APPSTORE_VENDOR_NUMBER || ''
};
