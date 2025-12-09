
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
import { generateAppStoreToken, fetchAppReviews } from '../backend/appStoreService';

// Initialize Clients with safer env handling
const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Supabase credentials missing: require SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_KEY');
}

let supabase: SupabaseClient | null = null;
const getSupabase = () => {
  if (supabase) return supabase;
  if (!supabaseUrl || !serviceKey) return null;
  supabase = createClient(supabaseUrl, serviceKey);
  return supabase;
};

// AI client is optional; when missing, we fall back to neutral
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// AI Helper
async function analyzeReview(body: string) {
  if (!ai) return { sentiment: 'neutral', topics: [] };
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
  const client = getSupabase();
  if (!client) {
    return res.status(500).json({
      error: 'Supabase env missing',
      details: 'Require SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) and SUPABASE_URL (or VITE_SUPABASE_URL)'
    });
  }

  // --- Security Check ---
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuthorized = (!!cronSecret && (req.headers['authorization'] === `Bearer ${cronSecret}`)) || (req.query.key === cronSecret);
  let isAdmin = false;

  if (!isCronAuthorized) {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await client.auth.getUser(token);
      if (user) {
         const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single();
         if (profile?.role === 'admin') isAdmin = true;
      }
    }
  }

  if (!isCronAuthorized && !isAdmin) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (!geminiApiKey) {
      console.warn('GEMINI_API_KEY missing; proceeding with neutral sentiment/topics');
    }

    console.log("🚀 Starting Multi-Account Sync...");
    
    // 1. Load Global Settings
    const { data: settings, error: settingsError } = await client.from('settings').select('*').single();
    if (settingsError) {
      throw new Error(`Failed to load settings: ${settingsError.message}`);
    }
    const webhookUrl = settings?.webhook_url;

    // 2. Fetch All Developer Accounts
    const { data: accounts, error: accountsError } = await client.from('apple_accounts').select('*');
    if (accountsError) {
      throw new Error(`Failed to load apple_accounts: ${accountsError.message}`);
    }
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
            const { data: apps } = await client.from('apps').select('*').eq('account_id', account.id);
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
                        const { data: existing } = await client.from('reviews').select('id, is_edited').eq('review_id', reviewId).single();
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

                        await client.from('reviews').upsert(reviewData, { onConflict: 'review_id' });

                        if (!existing && reviewData.rating <= (settings?.notify_threshold || 2)) {
                             await sendNotification(webhookUrl, reviewData, app.name);
                        }
                    }
                } catch (err: any) {
                    console.error(`Failed to sync app ${app.name}`, err);
                    stats.errors++;
                }
            }
            // Log Success for Account
            await client.from('sync_logs').insert({
              account_id: account.id,
              status: 'success',
              new_reviews_count: accountNewCount,
              message: `Synced ${apps.length} apps successfully.`
            });

        } catch (accErr: any) {
            console.error(`Failed to process account ${account.name}`, accErr);
            stats.errors++;
            // Log Failure for Account
            await client.from('sync_logs').insert({
              account_id: account.id,
              status: 'failed',
              message: accErr?.message || 'Unknown error'
            });
        }
    }

    return res.status(200).json({ success: true, stats });

  } catch (error: any) {
    console.error("Sync Fatal Error:", error);
    return res.status(500).json({ error: error.message || 'Fatal error', details: error });
  }
}
