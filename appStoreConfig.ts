import { AppStoreConfig } from './types';

/**
 * App Store Connect API Configuration
 * 
 * Instructions to obtain these credentials:
 * 1. Log in to App Store Connect (https://appstoreconnect.apple.com).
 * 2. Navigate to "Users and Access" -> "Integrations" tab.
 * 3. Select "Key Type: App Store Connect API".
 * 4. Click the "+" button to generate a new API Key.
 *    - Name: Give it a recognizable name (e.g., "ReviewMonitor").
 *    - Access: Select "App Manager" (required to reply to reviews) or "Customer Support".
 * 5. Download the API Key file (.p8). 
 *    IMPORTANT: This file can only be downloaded once. Store it securely.
 * 6. Copy the "Issuer ID" and "Key ID" displayed on the page.
 */

export const appStoreConfig: AppStoreConfig = {
  // The Issuer ID is a UUID identifying your team (found above the key list).
  // Example: "57246542-96fe-1a63-e053-0824d011072a"
  issuerId: "YOUR_ISSUER_ID_HERE",

  // The Key ID associated with the specific private key you generated.
  // Example: "2X9R4HXF96"
  keyId: "YOUR_KEY_ID_HERE",

  // The contents of the .p8 file you downloaded.
  // Open the .p8 file with a text editor and copy the entire content.
  // It must include the header and footer lines.
  privateKey: `-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_CONTENT_HERE
-----END PRIVATE KEY-----`,

  // Optional: Vendor Number (found in "Payments and Financial Reports").
  // Required only if you plan to access Sales/Financial reports later.
  vendorNumber: "" 
};
