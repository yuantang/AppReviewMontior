
import { appStoreConfig } from '../appStoreConfig.js';
import { generateAppStoreToken, fetchAppReviews } from './appStoreService.js';
import { supabase } from './supabaseClient.js';
import { GoogleGenAI } from "@google/genai";
import { SENTIMENT_ANALYSIS_PROMPT, TOPIC_EXTRACTION_PROMPT, REPLY_GENERATION_PROMPT } from './ai_prompts.js';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "YOUR_GEMINI_KEY" });

/**
 * HELPER: Run AI Analysis on a single review
 */
async function analyzeReview(reviewBody: string, title: string, rating: number) {
  try {
    const model = 'gemini-2.5-flash';

    // 1. Sentiment
    const sentimentPrompt = SENTIMENT_ANALYSIS_PROMPT
      .replace('{{title}}', title)
      .replace('{{body}}', reviewBody)
      .replace('{{rating}}', rating.toString());
    
    const sentimentRes = await ai.models.generateContent({ model, contents: sentimentPrompt });
    let sentiment = sentimentRes.text?.trim().toLowerCase() || 'neutral';
    // Fallback/Cleanup if AI is chatty
    if (sentiment.includes('positive')) sentiment = 'positive';
    else if (sentiment.includes('negative')) sentiment = 'negative';
    else sentiment = 'neutral';

    // 2. Topics
    const topicPrompt = TOPIC_EXTRACTION_PROMPT
      .replace('{{title}}', title)
      .replace('{{body}}', reviewBody);
    
    const topicRes = await ai.models.generateContent({ model, contents: topicPrompt });
    let topics: string[] = [];
    try {
      // Basic cleanup to find JSON array in markdown
      const jsonStr = topicRes.text?.match(/\[.*\]/s)?.[0];
      if (jsonStr) topics = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("Failed to parse topics JSON", e);
    }

    return { sentiment, topics };

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return { sentiment: 'neutral', topics: [] };
  }
}

// Fetch all reviews for an app across pagination, filtered by optional date range
async function fetchAllReviewsWithRange(appStoreId: string, token: string, start?: Date, end?: Date) {
  let nextUrl: string | undefined;
  const collected: any[] = [];

  while (true) {
    const response = await fetchAppReviews(appStoreId, token, nextUrl, start, end);
    const batch = response.data || [];

    for (const item of batch) {
      const createdAt = new Date(item.attributes.createdDate);
      if (start && createdAt < start) continue;
      if (end && createdAt > end) continue;
      collected.push(item);
    }

    const nextLink = (response.links?.next as any)?.href || response.links?.next;
    if (!nextLink) break;
    nextUrl = nextLink;
  }

  return collected;
}

/**
 * MAIN JOB: Sync Reviews
 * This function should be called by your Cron Scheduler (e.g., every 10 mins).
 */
type SyncOptions = {
  startDate?: string | 'all';
  endDate?: string | 'all';
  accountId?: number;
  appId?: number;
};

export async function runSyncJob(options?: SyncOptions) {
  console.log("⏰ Starting Sync Job...");
  // Default窗口：最近30天；传'all'表示不限制
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const rangeStart = options?.startDate === 'all' ? undefined : options?.startDate ? new Date(options.startDate) : defaultStart;
  const rangeEnd = options?.endDate === 'all' ? undefined : options?.endDate ? new Date(options.endDate) : defaultEnd;

  // 1. Get Apps to monitor from DB
  const { data: apps, error } = await supabase.from('apps').select('*');
  if (error || !apps) {
    console.error("Failed to fetch apps from DB:", error);
    return;
  }

  // 2. Load Apple developer accounts to build correct ES256 tokens per account
  const { data: accounts, error: accErr } = await supabase
    .from('apple_accounts')
    .select('id, issuer_id, key_id, private_key');

  if (accErr) {
    console.error("Failed to fetch apple_accounts:", accErr);
    return;
  }

  const hasEnvAppStoreConfig =
    appStoreConfig.issuerId &&
    !appStoreConfig.issuerId.includes('YOUR_') &&
    appStoreConfig.keyId &&
    !appStoreConfig.keyId.includes('YOUR_') &&
    appStoreConfig.privateKey &&
    !appStoreConfig.privateKey.includes('YOUR_PRIVATE_KEY_CONTENT_HERE');

  const tokenCache = new Map<number, string>();
  const getTokenForAccount = (accountId: number) => {
    if (tokenCache.has(accountId)) return tokenCache.get(accountId)!;
    const acc = accounts?.find(a => a.id === accountId);
    let token: string | null = null;

    if (acc?.issuer_id && acc?.key_id && acc?.private_key) {
      try {
        token = generateAppStoreToken({
          issuerId: acc.issuer_id.trim(),
          keyId: acc.key_id.trim(),
          privateKey: acc.private_key.trim()
        });
      } catch (e) {
        console.error(`Invalid App Store credentials for account ${accountId}:`, (e as any)?.message || e);
      }
    } else if (hasEnvAppStoreConfig) {
      try {
        token = generateAppStoreToken(appStoreConfig);
      } catch (e) {
        console.error('Invalid App Store env credentials:', (e as any)?.message || e);
      }
    }

    if (token) tokenCache.set(accountId, token);
    return token;
  };

  const targetApps = options?.appId ? apps.filter(a => a.id === options.appId) : apps;

  for (const app of targetApps) {
    if (options?.accountId && app.account_id !== options.accountId) continue;
    console.log(`Processing App: ${app.name} (${app.app_store_id})...`);
    
    // Resolve token for the app's owning developer account
    const token = getTokenForAccount(app.account_id);
    if (!token) {
      console.error(`No valid App Store credentials for account ${app.account_id}, skipping app ${app.name}`);
      continue;
    }

    try {
      // 3. Fetch latest reviews from Apple
      const reviews = await fetchAllReviewsWithRange(app.app_store_id, token, rangeStart, rangeEnd);

      for (const item of reviews) {
        const reviewId = item.id;
        const attributes = item.attributes;
        const createdAt = new Date(attributes.createdDate);

        // Apply dynamic range filter for safety
        if (rangeStart && createdAt < rangeStart) continue;
        if (rangeEnd && createdAt > rangeEnd) continue;
        
        // 4. Check if exists
        const { data: existing } = await supabase
          .from('reviews')
          .select('id, is_edited')
          .eq('review_id', reviewId)
          .single();

        // If exists and not edited, skip
        if (existing && !existing.is_edited) {
          continue; 
        }

        console.log(`--> New/Updated Review found: ${reviewId}`);

        // 5. Run AI Analysis
        const analysis = await analyzeReview(attributes.body, attributes.title, attributes.rating);

        // 6. Save to Supabase
        const reviewData = {
          app_id: app.id,
          review_id: reviewId,
          user_name: attributes.reviewerNickname,
          title: attributes.title,
          body: attributes.body,
          rating: attributes.rating,
          territory: attributes.territory,
          language_code: 'en', // Apple doesn't always provide this, might need detection
          app_version: 'unknown', // Apple often hides this in standard API, requires custom mapping
          is_edited: false, // Reset edited flag
          created_at_store: attributes.createdDate,
          sentiment: analysis.sentiment,
          topics: analysis.topics,
          need_reply: analysis.topics.includes('crash') || analysis.topics.includes('pay') || attributes.rating <= 2
        };

        const { error: upsertError } = await supabase
          .from('reviews')
          .upsert(reviewData, { onConflict: 'review_id' });

        if (upsertError) console.error("DB Error:", upsertError);

        // 7. (Optional) Check for Notifications
        if (reviewData.rating <= 2) {
            // await sendWebhookNotification(reviewData);
            console.log("!!! TRIGGER NOTIFICATION: Low Rating !!!");
        }
      }
      
    } catch (err: any) {
      const axiosData = err?.response?.data;
      console.error(`Failed to process app ${app.name}:`, err?.message || err, axiosData || '');
    }
  }
  
  console.log("✅ Sync Job Finished.");
}
