
import { Review, Sentiment } from "../types";
import { GoogleGenAI } from "@google/genai";
import { ANALYSIS_REPORT_PROMPT } from "../backend/ai_prompts";

export const generateReplyDraft = async (review: Review, apiKey?: string): Promise<string> => {
  if (!process.env.API_KEY) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Demo fallback logic based on topics...
    return `Hello ${review.user_name},\n\nThank you for your feedback! We appreciate your input. [Demo Mode]`;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      You are a helpful customer support agent for a mobile app.
      Review Details:
      User: ${review.user_name}
      Rating: ${review.rating} stars
      Comment: "${review.body}"
      Topics: ${review.topics.join(', ')}
      Sentiment: ${review.sentiment}

      Draft a polite, professional, and empathetic reply to this review.
      
      IMPORTANT RULES:
      1. DETECT the language of the user's review (e.g. English, Chinese, Japanese, etc.).
      2. REPLY IN THE SAME LANGUAGE as the user's review.
      3. Keep it under 100 words.
      4. Address the specific topics mentioned.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "Could not generate reply.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating reply. Please check API key or network connection.";
  }
};

export const translateText = async (text: string, apiKey?: string): Promise<string> => {
  if (!text) return "";
  if (!process.env.API_KEY) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return "[Demo] This is a simulated translation of: " + text.substring(0, 20) + "...";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Updated prompt to target Simplified Chinese
    const prompt = `Translate the following user review text into Simplified Chinese (简体中文). Only return the translated text, nothing else.\n\nText: "${text}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text?.trim() || "Translation failed.";
  } catch (error) {
    console.error("Gemini Translation Error:", error);
    return "Error translating text.";
  }
};

export const generateAnalysisReport = async (stats: any): Promise<string> => {
    if (!process.env.API_KEY) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return "## Executive Summary (Demo)\n\n**Overall Status:** User sentiment is mixed with a leaning towards negative feedback due to technical stability.\n\n**Key Risks:**\n* **Crashes** are the primary driver of 1-star reviews.\n* **Ads** frequency is a growing complaint.\n\n**Recommendation:** Prioritize stability fixes in v2.1.1 before releasing new features.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = ANALYSIS_REPORT_PROMPT
            .replace('{{totalReviews}}', stats.total)
            .replace('{{avgRating}}', stats.avg)
            .replace('{{positiveCount}}', stats.positive)
            .replace('{{neutralCount}}', stats.neutral)
            .replace('{{negativeCount}}', stats.negative)
            .replace('{{topTopics}}', stats.topics.join(', '));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Failed to generate report.";
    } catch (error) {
        console.error("Gemini Report Error:", error);
        return "Error generating report.";
    }
};
