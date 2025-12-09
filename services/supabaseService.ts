
import { createClient } from '@supabase/supabase-js';
import { Review, AppProduct, ReviewStatus } from '../types';

// Safely access environment variables whether in Vite, Node, or other environments
const getEnv = (key: string) => {
  // Try Vite's import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore access errors
  }

  // Try Node's process.env
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {
    // Ignore access errors
  }

  return undefined;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Initialize client with fallback to avoid runtime initialization errors
// We use dummy values if config is missing so the app can still load (and fall back to mock data)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co';
};

export const fetchReviewsFromDB = async (appId?: number, rating?: number): Promise<Review[]> => {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('reviews')
    .select('*')
    .order('created_at_store', { ascending: false });

  if (appId && appId !== 0) { // Assuming 0 or 'all' logic handled by caller
    query = query.eq('app_id', appId);
  }

  if (rating) {
    query = query.eq('rating', rating);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }

  return data as Review[];
};

export const fetchAppsFromDB = async (): Promise<AppProduct[]> => {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('apps').select('*');
  if (error) {
    console.error("Error fetching apps:", error);
    return [];
  }
  return data as AppProduct[];
};

// --- NEW METHODS FOR CRM FEATURES ---

export const fetchUserReviewHistory = async (userName: string): Promise<Review[]> => {
  if (!isSupabaseConfigured() || !userName) return [];

  const { data, error } = await supabase
    .from('reviews')
    .select('*, apps(name)') // Join with apps to see which app they reviewed
    .eq('user_name', userName)
    .order('created_at_store', { ascending: false });

  if (error) {
    console.error("Error fetching user history:", error);
    return [];
  }
  return data as any[];
};

export const updateReviewStatus = async (reviewId: number, status: ReviewStatus) => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from('reviews')
    .update({ status })
    .eq('id', reviewId);
  
  if (error) throw error;
};

export const updateReviewMetadata = async (reviewId: number, topics: string[], sentiment: string) => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('reviews')
      .update({ topics, sentiment })
      .eq('id', reviewId);
    
    if (error) throw error;
};
