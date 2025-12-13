
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { AppStoreConfig } from '../types.js';

/**
 * BACKEND SERVICE - NODE.JS
 * 
 * Dependencies required:
 * npm install jsonwebtoken axios
 */

/**
 * Generates a signed JWT for App Store Connect API authentication.
 * Token is valid for 20 minutes maximum.
 */
export const generateAppStoreToken = (credentials: { issuerId: string, keyId: string, privateKey: string }): string => {
  const { issuerId, keyId, privateKey } = credentials;
  
  // Ensure private key has correct formatting (newlines)
  const formattedKey = privateKey.replace(/\\n/g, '\n');

  const payload = {
    iss: issuerId,
    exp: Math.floor(Date.now() / 1000) + (10 * 60), // Expire in 10 mins
    aud: 'appstoreconnect-v1'
  };

  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT'
  };

  // @ts-ignore - In a real Node env, jwt is available
  return jwt.sign(payload, formattedKey, { algorithm: 'ES256', header });
};

/**
 * Fetches reviews for a specific App ID.
 * Optionally constrain by createdDate range.
 */
export const fetchAppReviews = async (
  appStoreId: string,
  token: string,
  nextUrl?: string,
  _startDate?: Date,
  _endDate?: Date
) => {
  // NOTE: Apple App Store Connect Reviews API does not support createdDate filter.
  // We paginate all reviews (newest first) and perform client-side filtering.
  const url = nextUrl || `https://api.appstoreconnect.apple.com/v1/apps/${appStoreId}/customerReviews?sort=-createdDate&include=response&limit=200`;
  
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    return {
      data: response.data.data, // The reviews array
      included: response.data.included, // The developer responses
      links: response.data.links, // Pagination links
      meta: response.data.meta
    };
  } catch (error: any) {
    console.error(`Error fetching reviews for App ID ${appStoreId}:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetches the list of all Apps available in the Apple Developer Account.
 * Used for "Smart Import" feature.
 */
export const fetchAppsList = async (token: string) => {
  // Apple API to list apps
  const url = `https://api.appstoreconnect.apple.com/v1/apps?limit=200&fields[apps]=name,bundleId,sku`;
  
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Map to a cleaner format
    return response.data.data.map((item: any) => ({
        id: item.id,
        name: item.attributes.name,
        bundleId: item.attributes.bundleId,
        sku: item.attributes.sku
    }));

  } catch (error: any) {
    console.error(`Error fetching app list:`, error.response?.data || error.message);
    throw error;
  }
};
