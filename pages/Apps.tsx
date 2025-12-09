
import React, { useState, useEffect } from 'react';
import { Smartphone, Plus, Trash2, X, Search, Loader2, Lock, AlertTriangle, ArrowRight } from 'lucide-react';
import { MOCK_APPS } from '../constants';
import { AppProduct, AppleAccount, AppleAppImport } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';

const Apps: React.FC = () => {
  const { isAdmin, session } = useAuth();
  const { t } = useLanguage();
  const [apps, setApps] = useState<AppProduct[]>([]);
  const [accounts, setAccounts] = useState<AppleAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Import Mode State
  const [importMode, setImportMode] = useState<'manual' | 'import'>('import');
  const [importableApps, setImportableApps] = useState<AppleAppImport[]>([]);
  const [loadingImport, setLoadingImport] = useState(false);
  const [selectedImportApp, setSelectedImportApp] = useState<string | null>(null);

  // Form State
  const [newApp, setNewApp] = useState({
    name: '',
    app_store_id: '',
    bundle_id: '',
    platform: 'ios' as 'ios' | 'android',
    account_id: ''
  });

  // Fetch Data
  const fetchData = async () => {
    if (!isSupabaseConfigured()) {
      setApps(MOCK_APPS);
      return;
    }
    
    setLoading(true);
    // Fetch Apps
    const { data: appsData } = await supabase.from('apps').select('*').order('created_at', { ascending: false });
    if (appsData) setApps(appsData as AppProduct[]);

    // Fetch Accounts (For dropdown)
    if (isAdmin) {
        const { data: accData } = await supabase.from('apple_accounts').select('id, name');
        if (accData) setAccounts(accData as AppleAccount[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin]);

  const handleDeleteApp = async (id: number) => {
    if (!isAdmin) return alert("Admins only.");
    if (!confirm('Stop monitoring this app? Data will be deleted.')) return;
    if (isSupabaseConfigured()) await supabase.from('apps').delete().eq('id', id);
    setApps(apps.filter(a => a.id !== id));
  };

  const handleFetchAppsFromApple = async () => {
      if (!newApp.account_id) return alert("Select an account first.");
      setLoadingImport(true);
      try {
          const res = await axios.post('/api/admin', 
              { action: 'list_apps_from_apple', accountId: Number(newApp.account_id) },
              { headers: { Authorization: `Bearer ${session?.access_token}` } }
          );
          if (res.data.success) {
              setImportableApps(res.data.apps);
          } else {
              alert("Failed to fetch apps.");
          }
      } catch (e: any) {
          alert("Error: " + (e.response?.data?.error || e.message));
      }
      setLoadingImport(false);
  };

  const handleSelectImportApp = (appId: string) => {
      const selected = importableApps.find(a => a.id === appId);
      if (selected) {
          setSelectedImportApp(appId);
          setNewApp({
              ...newApp,
              name: selected.name,
              app_store_id: selected.id,
              bundle_id: selected.bundleId
          });
      }
  };

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApp.name || !newApp.app_store_id || !newApp.account_id) return alert("Please fill all required fields and select an account.");

    setSubmitting(true);
    const appPayload = {
      name: newApp.name,
      app_store_id: newApp.app_store_id,
      bundle_id: newApp.bundle_id || `com.app.${newApp.app_store_id}`,
      platform: newApp.platform,
      account_id: Number(newApp.account_id)
    };

    if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('apps').insert(appPayload).select();
        if (error) alert("Error: " + error.message);
        else if (data) {
            setApps([data[0] as AppProduct, ...apps]);
            setIsModalOpen(false);
            setNewApp({ name: '', app_store_id: '', bundle_id: '', platform: 'ios', account_id: '' });
            setImportableApps([]);
            setSelectedImportApp(null);
        }
    }
    setSubmitting(false);
  };

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    app.bundle_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('apps.title')}</h1>
          <p className="text-slate-500 mt-1">{t('apps.subtitle')}</p>
        </div>
        
        {isAdmin ? (
          <button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">
            <Plus size={18} />
            <span>{t('apps.add_new')}</span>
          </button>
        ) : (
          <div className="flex items-center space-x-2 text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg text-sm">
             <Lock size={14} /> <span>{t('apps.view_only')}</span>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 relative">
        <Search className="absolute left-7 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
        <input type="text" placeholder={t('apps.search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div> : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map(app => (
          <div key={app.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                 {app.icon_url ? <img src={app.icon_url} alt={app.name} className="w-full h-full object-cover" /> : <Smartphone className="text-slate-300" size={32} />}
              </div>
              {isAdmin && (
                <button onClick={() => handleDeleteApp(app.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={18} /></button>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{app.name}</h3>
            <p className="text-xs text-slate-400 font-mono mb-4">{app.bundle_id}</p>
            <div className="mt-auto flex justify-between text-sm border-t border-slate-50 pt-3">
               <span className="text-slate-500">{t('apps.id')}: {app.app_store_id}</span>
               <span className="text-slate-400 text-xs bg-slate-100 px-2 py-0.5 rounded">iOS</span>
            </div>
          </div>
        ))}
        {filteredApps.length === 0 && !loading && <div className="col-span-3 text-center py-10 text-slate-400">{t('apps.no_apps')}</div>}
      </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">{t('apps.modal.title')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
                <form onSubmit={handleAddApp} className="space-y-4">
                    
                    {/* Account Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('apps.modal.account')}</label>
                        {accounts.length > 0 ? (
                            <select required value={newApp.account_id} onChange={e => setNewApp({...newApp, account_id: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="">{t('apps.modal.select_account')}</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        ) : (
                            <div className="p-3 bg-yellow-50 text-yellow-700 text-xs rounded-lg border border-yellow-200">
                                <AlertTriangle size={14} className="inline mr-1" />
                                {t('apps.modal.no_accounts')} <Link to="/settings" className="underline font-bold">Go to Settings</Link> to add one first.
                            </div>
                        )}
                    </div>

                    {/* Import Toggle */}
                    {newApp.account_id && (
                        <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg mb-4">
                             <button type="button" onClick={() => setImportMode('import')} className={`flex-1 text-xs py-1.5 font-medium rounded-md transition-colors ${importMode === 'import' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>{t('apps.modal.smart_import')}</button>
                             <button type="button" onClick={() => setImportMode('manual')} className={`flex-1 text-xs py-1.5 font-medium rounded-md transition-colors ${importMode === 'manual' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>{t('apps.modal.manual_entry')}</button>
                        </div>
                    )}

                    {/* Mode: Import */}
                    {importMode === 'import' && newApp.account_id && (
                        <div className="space-y-4 border border-blue-100 bg-blue-50 p-4 rounded-lg">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold text-blue-800">{t('apps.modal.load_apps')}</h4>
                                <button type="button" onClick={handleFetchAppsFromApple} disabled={loadingImport} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center">
                                    {loadingImport && <Loader2 size={12} className="animate-spin mr-1" />}
                                    {t('apps.modal.load_list')}
                                </button>
                            </div>
                            
                            {importableApps.length > 0 && (
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                    {importableApps.map(app => (
                                        <div 
                                            key={app.id} 
                                            onClick={() => handleSelectImportApp(app.id)}
                                            className={`p-2 rounded border cursor-pointer text-sm flex justify-between items-center hover:bg-white transition-colors ${selectedImportApp === app.id ? 'bg-white border-blue-500 ring-1 ring-blue-500' : 'border-blue-200 bg-blue-50/50'}`}
                                        >
                                            <div className="overflow-hidden">
                                                <div className="font-bold text-slate-800 truncate">{app.name}</div>
                                                <div className="text-xs text-slate-500 font-mono">{app.bundleId}</div>
                                            </div>
                                            {selectedImportApp === app.id && <div className="text-blue-600"><ArrowRight size={16} /></div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Fields (Auto-filled or Manual) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('apps.modal.name')}</label>
                        <input required type="text" value={newApp.name} onChange={e => setNewApp({...newApp, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50" placeholder="My App" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('apps.modal.id')}</label>
                            <input required type="text" value={newApp.app_store_id} onChange={e => setNewApp({...newApp, app_store_id: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50" placeholder="123456789" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('apps.modal.bundle')}</label>
                            <input type="text" value={newApp.bundle_id} onChange={e => setNewApp({...newApp, bundle_id: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50" placeholder="com.example.app" />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 mt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 text-sm hover:bg-slate-100 rounded-lg">{t('apps.modal.cancel')}</button>
                        <button type="submit" disabled={submitting || accounts.length === 0} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center">
                        {submitting && <Loader2 size={16} className="mr-2 animate-spin" />} 
                        {importMode === 'import' && selectedImportApp ? t('apps.modal.confirm_import') : t('apps.modal.add')}
                        </button>
                    </div>
                </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Apps;
