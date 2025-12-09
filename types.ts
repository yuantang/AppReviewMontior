
export enum Sentiment {
  Positive = 'positive',
  Neutral = 'neutral',
  Negative = 'negative'
}

export type ReviewStatus = 'pending' | 'investigating' | 'resolved' | 'ignored';

export interface AppleAccount {
  id: number;
  name: string;
  issuer_id: string;
  key_id: string;
  private_key?: string; // Optional in frontend lists for security
  vendor_number?: string;
}

export interface AppProduct {
  id: number;
  account_id?: number; // Link to AppleAccount
  app_store_id: string;
  name: string;
  bundle_id: string;
  platform: 'ios' | 'android';
  icon_url: string;
}

export interface Review {
  id: number;
  app_id: number;
  review_id: string;
  user_name: string;
  title: string;
  body: string;
  rating: number;
  territory: string;
  language_code: string;
  app_version: string;
  is_edited: boolean;
  created_at_store: string;
  sentiment: Sentiment;
  topics: string[];
  need_reply: boolean;
  reply_content?: string;
  replied_at?: string;
  
  // Workflow
  status?: ReviewStatus;

  // Translation Fields
  translated_title?: string;
  translated_body?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface AppStoreConfig {
  issuerId: string;
  keyId: string;
  privateKey: string;
  vendorNumber?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'viewer';
}

export interface UserAppPermission {
  id: number;
  user_id: string;
  app_id: number;
  can_reply: boolean;
  app?: AppProduct; // For UI display
}

export interface SystemSettings {
  id: number;
  webhook_url: string;
  notify_threshold: number;
  sync_interval: number;
}

export interface SyncLog {
  id: number;
  account_id: number;
  status: 'success' | 'failed';
  message: string;
  new_reviews_count: number;
  created_at: string;
  account?: { name: string };
}

export interface ReplyTemplate {
  id: number;
  name: string;
  content: string;
}

// Helper for importing from Apple
export interface AppleAppImport {
  id: string; // Apple ID
  name: string;
  bundleId: string;
  sku: string;
}
