
import { appStoreConfig } from '../appStoreConfig';
import { generateAppStoreToken, fetchAppReviews } from './appStoreService';
import { supabase } from './supabaseClient';
import { GoogleGenAI } from "@google/genai";
import { SENTIMENT_ANALYSIS_PROMPT, TOPIC_EXTRACTION_PROMPT, REPLY_GENERATION_PROMPT } from './ai_prompts';

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

/**
 * MAIN JOB: Sync Reviews
 * This function should be called by your Cron Scheduler (e.g., every 10 mins).
 */
export async function runSyncJob() {
  console.log("⏰ Starting Sync Job...");

  // 1. Get Apps to monitor from DB
  const { data: apps, error } = await supabase.from('apps').select('*');
  if (error || !apps) {
    console.error("Failed to fetch apps from DB:", error);
    return;
  }

  // 2. Generate Apple Token (Shared for all calls in this batch)
  const token = generateAppStoreToken(appStoreConfig);

  for (const app of apps) {
    console.log(`Processing App: ${app.name} (${app.app_store_id})...`);
    
    try {
      // 3. Fetch latest reviews from Apple
      // In production, you might check 'sync_log' to know the last processed date
      // to avoid fetching too much history.
      const response = await fetchAppReviews(app.app_store_id, token);
      const reviews = response.data;

      for (const item of reviews) {
        const reviewId = item.id;
        const attributes = item.attributes;
        
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
