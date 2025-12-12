
import { appStoreConfig } from '../appStoreConfig.js';
import { generateAppStoreToken, fetchAppReviews } from './appStoreService.js';
import { supabase } from './supabaseClient';
import { GoogleGenAI } from "@google/genai";
import { SENTIMENT_ANALYSIS_PROMPT, TOPIC_EXTRACTION_PROMPT, REPLY_GENERATION_PROMPT } from './ai_prompts';

// Only ingest reviews within 2025
const HISTORICAL_START = new Date('2025-01-01T00:00:00Z');
const HISTORICAL_END = new Date('2025-12-31T23:59:59Z');

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

// Fetch all reviews for an app across pagination, stop when older than HISTORICAL_START
async function fetchAllReviewsForYear(appStoreId: string, token: string, start?: Date, end?: Date) {
  let nextUrl: string | undefined;
  const collected: any[] = [];

  while (true) {
    const response = await fetchAppReviews(appStoreId, token, nextUrl, start, end);
    const batch = response.data || [];

    for (const item of batch) {
      const createdAt = new Date(item.attributes.createdDate);
      // Collect任何处于目标年份区间的数据；不提前中断，以防排序变化遗漏 2025 数据
      if (createdAt >= HISTORICAL_START && createdAt <= HISTORICAL_END) {
        collected.push(item);
      }
      // 其他年份数据直接忽略，但继续翻页直到没有 next
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
  const rangeStart = options?.startDate === 'all' ? undefined : options?.startDate ? new Date(options.startDate) : HISTORICAL_START;
  const rangeEnd = options?.endDate === 'all' ? undefined : options?.endDate ? new Date(options.endDate) : HISTORICAL_END;

  // 1. Get Apps to monitor from DB
  const { data: apps, error } = await supabase.from('apps').select('*');
  if (error || !apps) {
    console.error("Failed to fetch apps from DB:", error);
    return;
  }

  // 2. Generate Apple Token (Shared for all calls in this batch)
  const token = generateAppStoreToken(appStoreConfig);

  const targetApps = options?.appId ? apps.filter(a => a.id === options.appId) : apps;

  for (const app of targetApps) {
    if (options?.accountId && app.account_id !== options.accountId) continue;
    console.log(`Processing App: ${app.name} (${app.app_store_id})...`);
    
    try {
      // 3. Fetch latest reviews from Apple
      const reviews = await fetchAllReviewsForYear(app.app_store_id, token, rangeStart, rangeEnd);

      for (const item of reviews) {
        const reviewId = item.id;
        const attributes = item.attributes;
        const createdAt = new Date(attributes.createdDate);

        // Skip historical data before configured start date
        if (createdAt < HISTORICAL_START) {
          continue;
        }
        
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
      
    } catch (err) {
      console.error(`Failed to process app ${app.name}:`, err);
    }
  }
  
  console.log("✅ Sync Job Finished.");
}
