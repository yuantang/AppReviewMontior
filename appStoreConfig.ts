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

export const appStoreConfig: AppStoreConfig = {
  issuerId: envIssuerId || 'YOUR_ISSUER_ID_HERE',
  keyId: envKeyId || 'YOUR_KEY_ID_HERE',
  privateKey: envPrivateKey || `-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_CONTENT_HERE
-----END PRIVATE KEY-----`,
  vendorNumber: process.env.APPSTORE_VENDOR_NUMBER || ''
};
