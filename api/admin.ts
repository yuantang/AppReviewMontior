
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateAppStoreToken, fetchAppsList } from '../backend/appStoreService';

// Lazy supabase init to avoid crashing route on missing envs; return clear 500 instead.
let supabase: SupabaseClient | null = null;
const getSupabase = () => {
  if (supabase) return supabase;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return null;
  }
  supabase = createClient(supabaseUrl, serviceKey);
  return supabase;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const client = getSupabase();
  if (!client) {
    return res.status(500).json({
      error: 'Supabase env missing',
      details: 'Require SUPABASE_SERVICE_KEY and SUPABASE_URL (or VITE_SUPABASE_URL)'
    });
  }

  // 1. Auth Check (Admin Only)
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  
  if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token', details: authError?.message });
  }

  const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admins only' });
  }

  // 2. Route Action
  const { action, accountId, account } = req.body;

  try {
      if (action === 'test_connection') {
          return await handleTestConnection(res, accountId);
      } 
      else if (action === 'list_apps_from_apple') {
          return await handleListApps(res, accountId);
      }
      else if (action === 'add_account') {
          return await handleAddAccount(res, account, client);
      }
      else {
          return res.status(400).json({ error: 'Invalid action' });
      }

  } catch (error: any) {
      console.error("Admin API Error:", error);
      return res.status(500).json({ error: error.message || 'Server error', details: error });
  }
}

async function getAccountCredentials(accountId: number) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase env missing');
    const { data: account, error } = await client.from('apple_accounts').select('*').eq('id', accountId).single();
    if (error || !account) throw new Error("Account not found");
    return account;
}

async function handleTestConnection(res: VercelResponse, accountId: number) {
    const account = await getAccountCredentials(accountId);
    
    try {
        const token = generateAppStoreToken({
            issuerId: account.issuer_id,
            keyId: account.key_id,
            privateKey: account.private_key
        });
        
        // Try to fetch 1 app just to see if credentials work
        await fetchAppsList(token);
        
        return res.status(200).json({ success: true, message: "Connection Successful!" });
    } catch (e: any) {
        return res.status(400).json({ success: false, error: "Connection Failed: " + (e.message || "Unknown error") });
    }
}

async function handleListApps(res: VercelResponse, accountId: number) {
    const account = await getAccountCredentials(accountId);
    const token = generateAppStoreToken({
        issuerId: account.issuer_id,
        keyId: account.key_id,
        privateKey: account.private_key
    });

    const apps = await fetchAppsList(token);
    return res.status(200).json({ success: true, apps });
}

async function handleAddAccount(res: VercelResponse, account: any, client: SupabaseClient) {
    if (!account?.name || !account?.issuer_id || !account?.key_id || !account?.private_key) {
        return res.status(400).json({ error: 'Missing account fields' });
    }

    const { error } = await client.from('apple_accounts').insert({
        name: account.name,
        issuer_id: account.issuer_id,
        key_id: account.key_id,
        private_key: account.private_key,
        vendor_number: account.vendor_number || null
    });

    if (error) {
        console.error('Add account error', error);
        return res.status(400).json({ error: error.message, details: error });
    }

    return res.status(200).json({ success: true });
}
