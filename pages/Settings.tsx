
import React, { useState, useEffect } from 'react';
import { Save, Bell, Globe, Shield, RefreshCw, CheckCircle, Loader2, Play, Users, Key, Trash2, Plus, Lock, FileText, Activity, Wifi } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';
import { SystemSettings, AppleAccount, UserProfile, AppProduct, SyncLog, ReplyTemplate } from '../types';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';

type Tab = 'general' | 'accounts' | 'users' | 'templates' | 'logs';

const Settings: React.FC = () => {
  const { isAdmin, isSuperAdmin, session } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [syncRange, setSyncRange] = useState<'30d' | '90d' | '180d' | '2025' | 'all'>('30d');
  const [syncAccountId, setSyncAccountId] = useState<'all' | number>('all');
  const [syncAppId, setSyncAppId] = useState<'all' | number>('all');
  
  // General Settings
  const [settings, setSettings] = useState<SystemSettings>({
    id: 1,
    webhook_url: '',
    notify_threshold: 2,
    sync_interval: 10
  });

  // Apple Accounts State
  const [accounts, setAccounts] = useState<AppleAccount[]>([]);
  const [newAccount, setNewAccount] = useState({ name: '', issuer_id: '', key_id: '', private_key: '' });
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // User Permissions State
    const [users, setUsers] = useState<UserProfile[]>([]);
  const [allApps, setAllApps] = useState<AppProduct[]>([]);
  const [userPermissions, setUserPermissions] = useState<Record<string, number[]>>({});

  // Sync Logs State
  const [logs, setLogs] = useState<SyncLog[]>([]);

  // Reply Templates State
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '' });

  useEffect(() => {
    if (isSupabaseConfigured()) {
      if (activeTab === 'general') loadSettings();
      if (activeTab === 'accounts') loadAccounts();
      if (activeTab === 'users') loadUsersAndPermissions();
      if (activeTab === 'templates') loadTemplates();
      if (activeTab === 'logs') loadLogs();
    }
  }, [activeTab]);

  // --- LOADERS ---
  const normalizeError = (err: any) => {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.message && typeof err.message === 'string') return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      if (session?.access_token) {
        // preload accounts/apps for sync filters
        loadAccounts();
        loadAppsForSync();
        const res = await axios.post('/api/admin', 
          { action: 'get_settings' },
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.data?.settings) {
          setSettings(res.data.settings as SystemSettings);
        }
      }
    } catch (e) {
      console.error('Load settings failed', e);
    }
    setLoading(false);
  };

  const loadAccounts = async () => {
    setLoading(true);
    try {
      if (session?.access_token) {
        const res = await axios.post('/api/admin',
          { action: 'list_accounts' },
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.data?.accounts) {
          setAccounts(res.data.accounts as AppleAccount[]);
        }
      }
    } catch (e) {
      console.error('Load accounts failed', e);
    }
    setLoading(false);
  };

  const loadAppsForSync = async () => {
    try {
      if (session?.access_token) {
        const res = await axios.post('/api/admin', { action: 'list_apps' }, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.data?.apps) setAllApps(res.data.apps as AppProduct[]);
      }
    } catch (e) {
      console.error('Load apps failed', e);
    }
  };

  const loadUsersAndPermissions = async () => {
    setLoading(true);
    try {
      if (session?.access_token) {
        const [usersRes, appsRes] = await Promise.all([
          axios.post('/api/admin', { action: 'list_users' }, { headers: { Authorization: `Bearer ${session.access_token}` } }),
          axios.post('/api/admin', { action: 'list_apps' }, { headers: { Authorization: `Bearer ${session.access_token}` } })
        ]);

        if (usersRes.data?.users) setUsers(usersRes.data.users as UserProfile[]);
        if (appsRes.data?.apps) setAllApps(appsRes.data.apps as AppProduct[]);

        const permsData = usersRes.data?.permissions || [];
        const permMap: Record<string, number[]> = {};
        permsData.forEach((p: any) => {
            if (!permMap[p.user_id]) permMap[p.user_id] = [];
            permMap[p.user_id].push(p.app_id);
        });
        setUserPermissions(permMap);
      }
    } catch (e) {
      console.error('Load users/perms failed', e);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase.from('reply_templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data as ReplyTemplate[]);
    setLoading(false);
  };

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase.from('sync_logs')
      .select('*, account:apple_accounts(name)')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setLogs(data as SyncLog[]);
    setLoading(false);
  };

  // --- ACTIONS ---

  const handleSaveSettings = async () => {
    if (!isSuperAdmin) return alert("Superadmin only.");
    setSaving(true);
    const { error } = await supabase.from('settings').upsert({ ...settings, id: 1 });
    if (error) alert("Error: " + error.message);
    else alert("Settings saved.");
    setSaving(false);
  };

  const handleAddAccount = async () => {
    if (!isSuperAdmin) return;
    if (!newAccount.name || !newAccount.private_key || !newAccount.issuer_id || !newAccount.key_id) {
      return alert("Fill all fields.");
    }
    setSaving(true);
    try {
      const res = await axios.post('/api/admin',
        { action: 'add_account', account: newAccount },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (res.data.success) {
        setNewAccount({ name: '', issuer_id: '', key_id: '', private_key: '' });
        setIsAddingAccount(false);
        loadAccounts();
      } else {
        alert(normalizeError(res.data.error || 'Error adding account.'));
      }
    } catch (e: any) {
      const errMsg = normalizeError(
        e.response?.data?.error ||
        e.response?.data?.message ||
        e.response?.data ||
        e
      );
      alert(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
      if (!confirm("Delete this account? Associated apps will stop syncing.")) return;
      const { error } = await supabase.from('apple_accounts').delete().eq('id', id);
      if (!error) loadAccounts();
  };

  const handleTestConnection = async (id: number) => {
      setTestingConnection(id);
      try {
          const res = await axios.post('/api/admin', 
              { action: 'test_connection', accountId: id },
              { headers: { Authorization: `Bearer ${session?.access_token}` } }
          );
          if (res.data.success) alert("✅ " + res.data.message);
          else alert("❌ " + res.data.error);
      } catch (e: any) {
          alert("❌ Connection Error: " + (e.response?.data?.error || e.message));
      }
      setTestingConnection(null);
  }

  const handleAddTemplate = async () => {
      if (!newTemplate.name || !newTemplate.content) return;
      setSaving(true);
      const { error } = await supabase.from('reply_templates').insert(newTemplate);
      if (error) alert(error.message);
      else {
          setNewTemplate({ name: '', content: '' });
          loadTemplates();
      }
      setSaving(false);
  };

  const handleDeleteTemplate = async (id: number) => {
      if (!confirm("Delete template?")) return;
      await supabase.from('reply_templates').delete().eq('id', id);
      loadTemplates();
  };

  const toggleUserAppPermission = async (userId: string, appId: number, currentStatus: boolean) => {
    if (!isSuperAdmin) return;
    try {
      await axios.post('/api/admin', 
        { action: 'set_user_app_permission', userId, appId, enable: !currentStatus },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      loadUsersAndPermissions();
    } catch (e) {
      alert('Failed to update permissions');
    }
  };

  const handleRoleChange = async (userId: string, role: 'admin' | 'viewer' | 'superadmin') => {
      if (!isSuperAdmin) return;
      try {
        await axios.post('/api/admin',
          { action: 'set_user_role', userId, role },
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
        loadUsersAndPermissions();
      } catch (e) {
        alert('Failed to update role');
      }
  };

  const updateUserApps = async (userId: string, selectedIds: number[]) => {
      if (!isSuperAdmin) return;
      const current = userPermissions[userId] || [];
      const toAdd = selectedIds.filter(id => !current.includes(id));
      const toRemove = current.filter(id => !selectedIds.includes(id));

      try {
        await Promise.all([
          ...toAdd.map(id => axios.post('/api/admin', 
            { action: 'set_user_app_permission', userId, appId: id, enable: true },
            { headers: { Authorization: `Bearer ${session?.access_token}` } }
          )),
          ...toRemove.map(id => axios.post('/api/admin', 
            { action: 'set_user_app_permission', userId, appId: id, enable: false },
            { headers: { Authorization: `Bearer ${session?.access_token}` } }
          ))
        ]);
        loadUsersAndPermissions();
      } catch (e) {
        alert('Failed to update app access');
      }
  };

  const toggleSingleApp = (userId: string, appId: number, currentPerms: number[], checked: boolean) => {
      if (!isSuperAdmin) return;
      const next = checked
        ? Array.from(new Set([...currentPerms, appId]))
        : currentPerms.filter(id => id !== appId);
      updateUserApps(userId, next);
  };

  const handleManualSync = async () => {
    if (!isAdmin) return alert("Admins only.");
    if (!confirm("Start manual sync?")) return;
    setSyncing(true);
    try {
      const body: any = {};
      const now = new Date();
      const rangeMap: Record<typeof syncRange, () => { start: string | 'all', end: string | 'all' }> = {
        '30d': () => {
          const start = new Date(now);
          start.setDate(start.getDate() - 30);
          return { start: start.toISOString(), end: now.toISOString() };
        },
        '90d': () => {
          const start = new Date(now);
          start.setDate(start.getDate() - 90);
          return { start: start.toISOString(), end: now.toISOString() };
        },
        '180d': () => {
          const start = new Date(now);
          start.setDate(start.getDate() - 180);
          return { start: start.toISOString(), end: now.toISOString() };
        },
        '2025': () => ({
          start: '2025-01-01T00:00:00Z',
          end: '2025-12-31T23:59:59Z'
        }),
        'all': () => ({ start: 'all', end: 'all' })
      };

      const range = rangeMap[syncRange]();
      body.startDate = range.start;
      body.endDate = range.end;
      if (syncAccountId !== 'all') body.accountId = syncAccountId;
      if (syncAppId !== 'all') body.appId = syncAppId;

      const response = await axios.post('/api/cron', body, { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
      alert(response.data.success ? `Sync triggered successfully.` : "Sync finished unexpectedly.");
      if (activeTab === 'logs') loadLogs();
    } catch (e: any) {
      const errPayload = e?.response?.data?.error ?? e?.message ?? e;
      const errText = typeof errPayload === 'string' ? errPayload : JSON.stringify(errPayload);
      alert("Sync failed: " + errText);
    }
    setSyncing(false);
  };

  if (!isAdmin) {
      return (
          <div className="p-8 text-center text-slate-500">
              <Lock className="mx-auto mb-4" size={48} />
              <h2 className="text-xl font-bold">{t('settings.access_restricted')}</h2>
              <p>{t('settings.admin_only')}</p>
          </div>
      )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{t('settings.title')}</h1>
      
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl mb-8 w-fit">
          <button onClick={() => setActiveTab('general')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
             {t('settings.tab.general')}
          </button>
          <button onClick={() => setActiveTab('accounts')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'accounts' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
             {t('settings.tab.accounts')}
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
             {t('settings.tab.users')}
          </button>
          <button onClick={() => setActiveTab('templates')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'templates' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
             {t('settings.tab.templates')}
          </button>
          <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
             {t('settings.tab.logs')}
          </button>
      </div>

      {loading && <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>}

      {/* --- GENERAL TAB --- */}
      {!loading && activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Bell className="mr-2 text-orange-500" /> {t('settings.gen.notifications')}</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.gen.webhook')}</label>
                  <input type="text" value={settings.webhook_url || ''} onChange={(e) => setSettings({...settings, webhook_url: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.gen.threshold')}</label>
                  <select value={settings.notify_threshold} onChange={(e) => setSettings({...settings, notify_threshold: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="1">1 Star</option>
                      <option value="2">2 Stars or less</option>
                      <option value="3">3 Stars or less</option>
                  </select>
               </div>
               <div className="pt-2">
                   <button onClick={handleSaveSettings} disabled={saving} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                       {saving ? t('common.loading') : t('settings.gen.save')}
                   </button>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><RefreshCw className="mr-2 text-blue-500" /> {t('settings.gen.sync')}</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">时间范围</p>
                    <select
                      value={syncRange}
                      onChange={(e) => setSyncRange(e.target.value as typeof syncRange)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="30d">最近 30 天（推荐）</option>
                      <option value="90d">最近 90 天</option>
                      <option value="180d">最近 180 天</option>
                      <option value="2025">2025 全年</option>
                      <option value="all">全部历史</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">开发者账号</p>
                    <select
                      value={syncAccountId}
                      onChange={(e) => { const val = e.target.value === 'all' ? 'all' : Number(e.target.value); setSyncAccountId(val); setSyncAppId('all'); }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="all">全部账号</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">应用</p>
                    <select
                      value={syncAppId}
                      onChange={(e) => setSyncAppId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="all">全部应用</option>
                      {(syncAccountId === 'all' ? allApps : allApps.filter(a => a.account_id === syncAccountId)).map(app => (
                        <option key={app.id} value={app.id}>{app.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-700">{t('settings.gen.manual_sync')}</p>
                        <p className="text-xs text-slate-400">{t('settings.gen.sync_desc')}</p>
                    </div>
                    <button onClick={handleManualSync} disabled={syncing} className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium">
                        {syncing ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                        <span>{syncing ? t('common.loading') : t('settings.gen.sync_now')}</span>
                    </button>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* --- ACCOUNTS TAB --- */}
      {!loading && activeTab === 'accounts' && (
         <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800">{t('settings.tab.accounts')}</h2>
                 <button 
                   onClick={() => isSuperAdmin && setIsAddingAccount(!isAddingAccount)} 
                   disabled={!isSuperAdmin}
                   className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                     <Plus size={16} className="mr-1" /> Add Account
                 </button>
             </div>

             {isAddingAccount && isSuperAdmin && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 animate-in fade-in">
                    <h3 className="font-bold text-slate-700 mb-3">New Account Credentials</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input type="text" placeholder="Account Name (e.g. My Company)" className="border rounded-lg px-3 py-2 text-sm" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} />
                        <input type="text" placeholder="Issuer ID" className="border rounded-lg px-3 py-2 text-sm" value={newAccount.issuer_id} onChange={e => setNewAccount({...newAccount, issuer_id: e.target.value})} />
                         <input type="text" placeholder="Key ID" className="border rounded-lg px-3 py-2 text-sm" value={newAccount.key_id} onChange={e => setNewAccount({...newAccount, key_id: e.target.value})} />
                     </div>
                     <textarea placeholder="Paste Private Key (.p8 content) here..." className="w-full border rounded-lg px-3 py-2 text-sm font-mono h-32 mb-4" value={newAccount.private_key} onChange={e => setNewAccount({...newAccount, private_key: e.target.value})} />
                     <div className="flex justify-end space-x-2">
                         <button onClick={() => setIsAddingAccount(false)} className="text-slate-500 px-3 py-2 text-sm">{t('common.cancel')}</button>
                         <button onClick={handleAddAccount} disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                             {saving ? t('common.loading') : 'Save Credentials'}
                         </button>
                     </div>
                 </div>
             )}

             <div className="grid grid-cols-1 gap-4">
                 {accounts.length === 0 ? (
                     <p className="text-slate-400 italic text-center py-8">No accounts linked yet.</p>
                 ) : accounts.map(acc => (
                     <div key={acc.id} className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center">
                         <div className="flex items-center space-x-3">
                             <div className="bg-slate-100 p-2 rounded-lg"><Key size={20} className="text-slate-500" /></div>
                             <div>
                                 <h4 className="font-bold text-slate-800">{acc.name}</h4>
                                 <p className="text-xs text-slate-400 font-mono">Issuer: {acc.issuer_id}</p>
                             </div>
                         </div>
                         <div className="flex items-center space-x-2">
                            <button 
                                onClick={() => handleTestConnection(acc.id)} 
                                disabled={testingConnection === acc.id || !isSuperAdmin}
                                className="flex items-center space-x-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {testingConnection === acc.id ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                                <span>Test Connection</span>
                            </button>
                            <button onClick={() => isSuperAdmin && handleDeleteAccount(acc.id)} disabled={!isSuperAdmin} className="text-red-500 hover:bg-red-50 p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={18} /></button>
                         </div>
                     </div>
                 ))}
             </div>
         </div>
      )}

      {/* --- USERS TAB --- */}
      {!loading && activeTab === 'users' && (
          <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800">{t('settings.tab.users')}</h2>
              
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                          <tr>
                              <th className="px-6 py-3">User</th>
                              <th className="px-6 py-3">Role</th>
                              <th className="px-6 py-3">Assigned Apps</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {users.map(user => {
                              const perms = userPermissions[user.id] || [];
                              return (
                              <tr key={user.id}>
                                  <td className="px-6 py-4 font-medium text-slate-800">{user.email}</td>
                                  <td className="px-6 py-4">
                                    <select
                                      value={user.role}
                                      onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'viewer' | 'superadmin')}
                                      disabled={!isSuperAdmin}
                                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <option value="viewer">viewer</option>
                                      <option value="admin">admin</option>
                                      <option value="superadmin">superadmin</option>
                                    </select>
                                  </td>
                                  <td className="px-6 py-4">
                                      {user.role === 'superadmin' ? (
                                        <span className="text-slate-400 italic text-xs">Full Access</span>
                                      ) : allApps.length === 0 ? (
                                        <span className="text-slate-400 text-xs">No apps available</span>
                                      ) : (
                                        <div className="border border-slate-200 rounded-lg p-2 bg-white max-w-xs">
                                          <div className="text-[11px] text-slate-400 mb-1">Select Apps</div>
                                          <div className="space-y-1 max-h-32 overflow-auto pr-1">
                                            {allApps.map(app => {
                                              const hasPerm = perms.includes(app.id);
                                              return (
                                                <label key={app.id} className="flex items-center space-x-2 text-xs text-slate-700">
                                                  <input 
                                                    type="checkbox" 
                                                    checked={hasPerm}
                                                    disabled={!isSuperAdmin}
                                                    onChange={(e) => toggleSingleApp(user.id, app.id, perms, e.target.checked)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                  />
                                                  <span>{app.name}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                  </td>
                              </tr>
                          )})}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- TEMPLATES TAB (P1) --- */}
      {!loading && activeTab === 'templates' && (
        <div className="space-y-6">
           <h2 className="text-lg font-bold text-slate-800">{t('settings.tab.templates')}</h2>
           <p className="text-sm text-slate-500">Preset responses for quick replies.</p>

           <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
               <div className="flex gap-4 mb-2">
                   <input 
                      type="text" 
                      placeholder="Template Name (e.g. Thank You)" 
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      value={newTemplate.name}
                      onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                    />
               </div>
               <textarea 
                  placeholder="Template Content..." 
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
                  rows={2}
                  value={newTemplate.content}
                  onChange={e => setNewTemplate({...newTemplate, content: e.target.value})}
               />
               <button 
                  onClick={handleAddTemplate} 
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Add Template
               </button>
           </div>

           <div className="grid gap-3">
               {templates.map(t => (
                   <div key={t.id} className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-start">
                       <div>
                           <h4 className="font-bold text-slate-800 text-sm">{t.name}</h4>
                           <p className="text-slate-600 text-sm mt-1 whitespace-pre-wrap">{t.content}</p>
                       </div>
                       <button onClick={() => handleDeleteTemplate(t.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                   </div>
               ))}
               {templates.length === 0 && <p className="text-center text-slate-400 py-4 italic">No templates created.</p>}
           </div>
        </div>
      )}

      {/* --- LOGS TAB (P0) --- */}
      {!loading && activeTab === 'logs' && (
          <div className="space-y-6">
               <div className="flex justify-between items-center">
                   <h2 className="text-lg font-bold text-slate-800">{t('settings.tab.logs')}</h2>
                   <button onClick={loadLogs} className="text-blue-600 hover:underline text-sm flex items-center"><RefreshCw size={14} className="mr-1" /> Refresh</button>
               </div>
               <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                   <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                           <tr>
                               <th className="px-6 py-3">Time</th>
                               <th className="px-6 py-3">Account</th>
                               <th className="px-6 py-3">Status</th>
                               <th className="px-6 py-3">Details</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {logs.map(log => (
                               <tr key={log.id}>
                                   <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                       {new Date(log.created_at).toLocaleString()}
                                   </td>
                                   <td className="px-6 py-4 font-medium text-slate-800">
                                       {log.account?.name || 'Unknown'}
                                   </td>
                                   <td className="px-6 py-4">
                                       {log.status === 'success' ? (
                                           <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium flex items-center w-fit">
                                               <CheckCircle size={12} className="mr-1" /> {t('common.success')}
                                           </span>
                                       ) : (
                                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium flex items-center w-fit">
                                               <Activity size={12} className="mr-1" /> Failed
                                           </span>
                                       )}
                                   </td>
                                   <td className="px-6 py-4 text-slate-600">
                                       {log.message}
                                       {log.new_reviews_count > 0 && <span className="ml-2 bg-blue-50 text-blue-600 px-1.5 rounded text-xs">+{log.new_reviews_count} new</span>}
                                   </td>
                               </tr>
                           ))}
                           {logs.length === 0 && (
                               <tr><td colSpan={4} className="text-center py-8 text-slate-400">No logs found.</td></tr>
                           )}
                       </tbody>
                   </table>
               </div>
          </div>
      )}

    </div>
  );
};

export default Settings;
