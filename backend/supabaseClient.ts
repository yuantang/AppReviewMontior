
import { createClient } from '@supabase/supabase-js';

// NOTE: In a real backend environment, use process.env.SUPABASE_URL
// These keys should be the SERVICE_ROLE key for backend writing permissions, 
// not the Anon key used in frontend.
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false // No need for session persistence in backend scripts
  }
});
