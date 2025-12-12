
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
// Explicit .js extension for Node ESM resolution in Vercel bundle
import { runSyncJob } from '../backend/syncTask.js';

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
         if (profile?.role === 'admin' || profile?.role === 'superadmin') isAdmin = true;
      }
    }
  }

  if (!isCronAuthorized && !isAdmin) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const body = (req.method === 'POST' ? req.body : {}) as any;
    const { startDate, endDate, accountId, appId } = body;
    await runSyncJob({ startDate, endDate, accountId: accountId ? Number(accountId) : undefined, appId: appId ? Number(appId) : undefined });
    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("Sync Fatal Error:", error);
    return res.status(500).json({ error: error.message || 'Fatal error', details: error });
  }
}
