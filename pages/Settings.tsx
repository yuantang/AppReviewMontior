
import React, { useState, useEffect } from 'react';
import { Save, Bell, Globe, Shield, RefreshCw, CheckCircle, Loader2, Play, Users, Key, Trash2, Plus, Lock, FileText, Activity, Wifi } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';
import { SystemSettings, AppleAccount, UserProfile, AppProduct, SyncLog, ReplyTemplate } from '../types';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';

type Tab = 'general' | 'accounts' | 'users' | 'templates' | 'logs';

const Settings: React.FC = () => {
  const { isAdmin, session } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  
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
  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('*').single();
    if (data) setSettings(data as SystemSettings);
    setLoading(false);
  };

  const loadAccounts = async () => {
    setLoading(true);
    const { data } = await supabase.from('apple_accounts').select('id, name, issuer_id, key_id');
    if (data) setAccounts(data as AppleAccount[]);
    setLoading(false);
  };

  const loadUsersAndPermissions = async () => {
    setLoading(true);
    const { data: usersData } = await supabase.from('profiles').select('*');
    if (usersData) setUsers(usersData as UserProfile[]);

    const { data: appsData } = await supabase.from('apps').select('id, name');
    if (appsData) setAllApps(appsData as AppProduct[]);

    const { data: permsData } = await supabase.from('user_apps').select('*');
    const permMap: Record<string, number[]> = {};
    if (permsData) {
        permsData.forEach((p: any) => {
            if (!permMap[p.user_id]) permMap[p.user_id] = [];
            permMap[p.user_id].push(p.app_id);
        });
    }
    setUserPermissions(permMap);
    setLoading(false);
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
    if (!isAdmin) return alert("Admins only.");
    setSaving(true);
    const { error } = await supabase.from('settings').upsert({ ...settings, id: 1 });
    if (error) alert("Error: " + error.message);
    else alert("Settings saved.");
    setSaving(false);
  };

  const handleAddAccount = async () => {
    if (!newAccount.name || !newAccount.private_key) return alert("Fill all fields.");
    setSaving(true);
    const { error } = await supabase.from('apple_accounts').insert(newAccount);
    if (error) alert("Error: " + error.message);
    else {
        setNewAccount({ name: '', issuer_id: '', key_id: '', private_key: '' });
        setIsAddingAccount(false);
        loadAccounts();
    }
    setSaving(false);
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
      if (currentStatus) {
          await supabase.from('user_apps').delete().match({ user_id: userId, app_id: appId });
      } else {
          await supabase.from('user_apps').insert({ user_id: userId, app_id: appId, can_reply: false });
      }
      loadUsersAndPermissions();
  };

  const handleManualSync = async () => {
    if (!isAdmin) return alert("Admins only.");
    if (!confirm("Start manual sync?")) return;
    setSyncing(true);
    try {
      const response = await axios.get('/api/cron', { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
      alert(response.data.success ? `Sync Complete! Found ${response.data.stats.new} new reviews.` : "Sync finished unexpectedly.");
      if (activeTab === 'logs') loadLogs();
    } catch (e: any) {
      alert("Sync failed: " + (e.response?.data?.error || e.message));
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
      )}

      {/* --- ACCOUNTS TAB --- */}
      {!loading && activeTab === 'accounts' && (
         <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800">{t('settings.tab.accounts')}</h2>
                 <button onClick={() => setIsAddingAccount(!isAddingAccount)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center">
                     <Plus size={16} className="mr-1" /> Add Account
                 </button>
             </div>

             {isAddingAccount && (
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
                                disabled={testingConnection === acc.id}
                                className="flex items-center space-x-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-medium transition-colors"
                            >
                                {testingConnection === acc.id ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                                <span>Test Connection</span>
                            </button>
                            <button onClick={() => handleDeleteAccount(acc.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={18} /></button>
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
                          {users.map(user => (
                              <tr key={user.id}>
                                  <td className="px-6 py-4 font-medium text-slate-800">{user.email}</td>
                                  <td className="px-6 py-4">
                                      <span className={`px-2 py-1 rounded-full text-xs border ${user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                          {user.role}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4">
                                      {user.role === 'admin' ? (
                                          <span className="text-slate-400 italic text-xs">Full Access</span>
                                      ) : (
                                          <div className="flex flex-wrap gap-2">
                                              {allApps.map(app => {
                                                  const hasPerm = userPermissions[user.id]?.includes(app.id);
                                                  return (
                                                      <button 
                                                          key={app.id}
                                                          onClick={() => toggleUserAppPermission(user.id, app.id, !!hasPerm)}
                                                          className={`px-2 py-1 rounded text-xs border transition-colors ${hasPerm ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-300 border-slate-100 grayscale'}`}
                                                      >
                                                          {app.name}
                                                      </button>
                                                  )
                                              })}
                                              {allApps.length === 0 && <span className="text-slate-400 text-xs">No apps available</span>}
                                          </div>
                                      )}
                                  </td>
                              </tr>
                          ))}
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
