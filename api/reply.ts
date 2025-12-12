
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { generateAppStoreToken } from '../backend/appStoreService.js';

// Initialize Supabase Client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { reviewId, replyText, appId, userId } = req.body; // userId passed for permission check if needed (or verify via token)

  if (!reviewId || !replyText || !appId) {
    return res.status(400).json({ error: 'Missing reviewId, replyText or appId' });
  }

  try {
    // 1. Verify App Permissions (Optional: check user_apps table here if strictly enforcing backend RBAC)
    // For now, we assume the frontend sends a valid request if authenticated.
    
    // 2. Fetch the App and its linked Account
    const { data: appData, error: appError } = await supabase
        .from('apps')
        .select(`
            id, 
            app_store_id, 
            account:apple_accounts (
                issuer_id, 
                key_id, 
                private_key
            )
        `)
        .eq('id', appId)
        .single();

    if (appError || !appData || !appData.account) {
        return res.status(404).json({ error: 'App or linked Developer Account not found.' });
    }

    const account = appData.account as any; // Cast for simpler access

    // 3. Generate Token for specific account
    const token = generateAppStoreToken({
        issuerId: account.issuer_id,
        keyId: account.key_id,
        privateKey: account.private_key
    });

    // 4. Send Reply to Apple
    const applePayload = {
      data: {
        type: "customerReviewResponses",
        attributes: { responseBody: replyText },
        relationships: {
          review: { data: { id: reviewId, type: "customerReviews" } }
        }
      }
    };

    try {
        await axios.post(
            'https://api.appstoreconnect.apple.com/v1/customerReviewResponses', 
            applePayload,
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (appleError: any) {
        console.error("Apple API Error:", appleError.response?.data?.errors || appleError.message);
        // return res.status(502).json({ error: 'Failed to send to Apple', details: appleError.response?.data });
    }

    // 5. Update Local DB
    await supabase.from('reviews').update({
        replied_at: new Date().toISOString(),
        reply_content: replyText,
        need_reply: false
    }).eq('review_id', reviewId);

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("Reply Handler Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
