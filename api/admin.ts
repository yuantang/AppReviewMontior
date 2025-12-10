
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Explicit .js extension for Node ESM resolution in Vercel bundle
import { generateAppStoreToken, fetchAppsList } from '../backend/appStoreService.js';

// Force Node runtime (not Edge) to ensure crypto/jwt work
export const config = {
  runtime: 'nodejs'
};

// Lazy supabase init to avoid crashing route on missing envs; return clear 500 instead.
let supabase: SupabaseClient | null = null;
const getSupabase = () => {
  if (supabase) return supabase;
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    return null;
  }
  supabase = createClient(supabaseUrl, serviceKey);
  return supabase;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const client = getSupabase();
    if (!client) {
      return res.status(500).json({
        error: 'Supabase env missing',
        details: 'Require SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) and SUPABASE_URL (or VITE_SUPABASE_URL)'
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

    const { data: profile, error: profileError } = await client.from('profiles').select('role').eq('id', user.id).single();
    if (profileError) {
      console.error('Profile fetch error', profileError);
      return res.status(500).json({ error: 'Profile fetch failed', details: profileError.message });
    }
    if (profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Admins only' });
    }

    // 2. Route Action
    const { action, accountId, account } = req.body || {};

    if (!action) {
      return res.status(400).json({ error: 'Missing action' });
    }

    if (action === 'test_connection') {
        return await handleTestConnection(res, accountId);
    } 
    else if (action === 'list_apps_from_apple') {
        return await handleListApps(res, accountId);
    }
    else if (action === 'list_accounts') {
        return await handleListAccounts(res, client);
    }
    else if (action === 'get_settings') {
        return await handleGetSettings(res, client);
    }
    else if (action === 'list_apps') {
        return await handleListAppsFromDb(res, client);
    }
    else if (action === 'list_reviews') {
        return await handleListReviews(res, client, req.body?.filters);
    }
    else if (action === 'add_app') {
        return await handleAddApp(res, account, client);
    }
    else if (action === 'add_account') {
        return await handleAddAccount(res, account, client);
    }
    else {
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error: any) {
    console.error("Admin API Error:", error);
    return res.status(500).json({ error: error?.message || 'Server error', details: error?.stack || error });
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

async function handleListAccounts(res: VercelResponse, client: SupabaseClient) {
    const { data, error } = await client
      .from('apple_accounts')
      .select('id,name,issuer_id,key_id');
    if (error) {
        return res.status(500).json({ error: error.message, details: error });
    }
    return res.status(200).json({ success: true, accounts: data });
}

async function handleGetSettings(res: VercelResponse, client: SupabaseClient) {
    const { data, error } = await client.from('settings').select('*').single();
    if (error) {
        return res.status(500).json({ error: error.message, details: error });
    }
    return res.status(200).json({ success: true, settings: data });
}

async function handleListAppsFromDb(res: VercelResponse, client: SupabaseClient) {
    const { data, error } = await client.from('apps').select('*').order('created_at', { ascending: false });
    if (error) {
        return res.status(500).json({ error: error.message, details: error });
    }
    return res.status(200).json({ success: true, apps: data });
}

async function handleListReviews(res: VercelResponse, client: SupabaseClient, filters?: any) {
    let query = client.from('reviews').select('*').order('created_at_store', { ascending: false });
    if (filters?.app_id) query = query.eq('app_id', filters.app_id);
    if (filters?.rating) query = query.eq('rating', filters.rating);
    const { data, error } = await query.limit(200);
    if (error) {
        return res.status(500).json({ error: error.message, details: error });
    }
    return res.status(200).json({ success: true, reviews: data });
}

async function handleAddApp(res: VercelResponse, app: any, client: SupabaseClient) {
    if (!app?.name || !app?.app_store_id || !app?.account_id) {
        return res.status(400).json({ error: 'Missing app fields' });
    }
    const payload = {
        name: app.name,
        app_store_id: app.app_store_id,
        bundle_id: app.bundle_id,
        platform: app.platform || 'ios',
        account_id: app.account_id
    };
    const { data, error } = await client.from('apps').insert(payload).select();
    if (error) {
        return res.status(500).json({ error: error.message, details: error });
    }
    return res.status(200).json({ success: true, app: data?.[0] });
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
