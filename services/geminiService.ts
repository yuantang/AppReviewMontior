
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
    // Detect language context from process.env.LANG or stats.lang; fallback to English
    const lang = (stats.lang || process.env.LANG || 'en').toLowerCase().includes('zh') ? 'zh' : 'en';

    if (!process.env.API_KEY) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (lang === 'zh') {
          return "## 决策摘要（演示）\n\n**整体状况：** 用户情绪偏中性，部分偏负面，主要集中在技术稳定性。\n\n**关键风险：**\n* **崩溃** 是一星评价的主要原因。\n* **广告频率** 引发越来越多的抱怨。\n\n**建议：** 在发布新功能前优先修复 v2.1.1 的稳定性问题。";
        }
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
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            // If needed, we can add safetySettings or generationConfig here
        });

        return response.text || "Failed to generate report.";
    } catch (error) {
        console.error("Gemini Report Error:", error);
        return "Error generating report.";
    }
};
