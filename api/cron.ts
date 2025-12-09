
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
import { generateAppStoreToken, fetchAppReviews } from '../backend/appStoreService';

// Initialize Clients
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// AI Helper
async function analyzeReview(body: string) {
  try {
    const model = 'gemini-2.5-flash';
    const sRes = await ai.models.generateContent({ model, contents: `Sentiment of: "${body}". Return one word: positive, neutral, negative.` });
    let sentiment = sRes.text?.trim().toLowerCase() || 'neutral';
    if (!['positive', 'negative', 'neutral'].includes(sentiment)) sentiment = 'neutral';

    const tRes = await ai.models.generateContent({ model, contents: `Extract tags from: "${body}". Choices: [crash, pay, ads, feature, ui, bug]. Return JSON array string.` });
    let topics: string[] = [];
    try {
      const jsonMatch = tRes.text?.match(/\[.*\]/s)?.[0];
      if (jsonMatch) topics = JSON.parse(jsonMatch);
    } catch (e) { /* ignore */ }

    return { sentiment, topics };
  } catch (e) {
    console.error("AI Error", e);
    return { sentiment: 'neutral', topics: [] };
  }
}

// Notification Helper
const sendNotification = async (webhookUrl: string | undefined, review: any, appName: string) => {
    if (!webhookUrl) return;
    try {
        const text = `⭐ ${review.rating}/5\n${review.title}\n"${review.body}"`;
        await axios.post(webhookUrl, {
            msg_type: "text",
            content: { text: `🚨 Negative Review for ${appName}:\n${text}` }
        });
    } catch (e) { console.error("Webhook failed"); }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // --- Security Check ---
  const isCronAuthorized = (req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`) || (req.query.key === process.env.CRON_SECRET);
  let isAdmin = false;

  if (!isCronAuthorized) {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
         const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
         if (profile?.role === 'admin') isAdmin = true;
      }
    }
  }

  if (!isCronAuthorized && !isAdmin) return res.status(401).json({ error: 'Unauthorized' });

  try {
    console.log("🚀 Starting Multi-Account Sync...");
    
    // 1. Load Global Settings
    const { data: settings } = await supabase.from('settings').select('*').single();
    const webhookUrl = settings?.webhook_url;

    // 2. Fetch All Developer Accounts
    const { data: accounts } = await supabase.from('apple_accounts').select('*');
    if (!accounts || accounts.length === 0) return res.json({ message: 'No developer accounts found.' });

    let stats = { processed: 0, new: 0, errors: 0 };

    // 3. Loop through Accounts
    for (const account of accounts) {
        console.log(`Checking Account: ${account.name}...`);
        let accountNewCount = 0;
        
        try {
            // A. Generate Token for this account
            const token = generateAppStoreToken({
                issuerId: account.issuer_id,
                keyId: account.key_id,
                privateKey: account.private_key
            });

            // B. Fetch Apps linked to this account
            const { data: apps } = await supabase.from('apps').select('*').eq('account_id', account.id);
            if (!apps || apps.length === 0) continue;

            // C. Sync Reviews for these apps
            for (const app of apps) {
                try {
                    const response = await fetchAppReviews(app.app_store_id, token);
                    const reviews = response.data;
                    
                    for (const item of reviews) {
                        stats.processed++;
                        const reviewId = item.id;
                        
                        // Check if exists
                        const { data: existing } = await supabase.from('reviews').select('id, is_edited').eq('review_id', reviewId).single();
                        if (existing && !existing.is_edited) continue;

                        stats.new++;
                        accountNewCount++;
                        const attr = item.attributes;
                        const analysis = await analyzeReview(attr.body);
                        
                        const reviewData = {
                            app_id: app.id,
                            review_id: reviewId,
                            user_name: attr.reviewerNickname,
                            title: attr.title,
                            body: attr.body,
                            rating: attr.rating,
                            territory: attr.territory,
                            created_at_store: attr.createdDate,
                            sentiment: analysis.sentiment,
                            topics: analysis.topics,
                            need_reply: attr.rating <= 2 || analysis.topics.includes('crash'),
                            updated_at: new Date().toISOString()
                        };

                        await supabase.from('reviews').upsert(reviewData, { onConflict: 'review_id' });

                        if (!existing && reviewData.rating <= (settings?.notify_threshold || 2)) {
                             await sendNotification(webhookUrl, reviewData, app.name);
                        }
                    }
                } catch (err) {
                    console.error(`Failed to sync app ${app.name}`, err);
                    stats.errors++;
                }
            }
            // Log Success for Account
            await supabase.from('sync_logs').insert({
              account_id: account.id,
              status: 'success',
              new_reviews_count: accountNewCount,
              message: `Synced ${apps.length} apps successfully.`
            });

        } catch (accErr: any) {
            console.error(`Failed to process account ${account.name}`, accErr);
            stats.errors++;
            // Log Failure for Account
            await supabase.from('sync_logs').insert({
              account_id: account.id,
              status: 'failed',
              message: accErr.message || 'Unknown error'
            });
        }
    }

    return res.status(200).json({ success: true, stats });

  } catch (error: any) {
    console.error("Sync Fatal Error:", error);
    return res.status(500).json({ error: error.message });
  }
}