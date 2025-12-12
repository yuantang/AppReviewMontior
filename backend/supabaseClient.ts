
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    'Supabase credentials missing. Please set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY).'
  );
}

const isValidUrl = (url: string) => /^https?:\/\/.+\.[a-zA-Z]{2,}/.test(url);
if (!isValidUrl(SUPABASE_URL)) {
  throw new Error(`Supabase URL is invalid: "${SUPABASE_URL}". Please check SUPABASE_URL/VITE_SUPABASE_URL.`);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false // No need for session persistence in backend scripts
  }
});
