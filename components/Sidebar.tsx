
import React from 'react';
import { LayoutDashboard, MessageSquare, Settings, PieChart, AppWindow, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();
  
  const menuItems = [
    { id: 'dashboard', label: t('nav.overview'), icon: LayoutDashboard },
    { id: 'reviews', label: t('nav.reviews'), icon: MessageSquare },
    { id: 'analysis', label: t('nav.analysis'), icon: PieChart },
    { id: 'apps', label: t('nav.apps'), icon: AppWindow },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50">
      <div className="p-6 flex items-center space-x-3 border-b border-slate-700">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <span className="font-bold text-lg">M</span>
        </div>
        <span className="font-bold text-lg tracking-tight">Monitor AI</span>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700 space-y-4">
        
        <div className="flex items-center space-x-3 text-slate-400 text-sm">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${profile?.role === 'admin' ? 'bg-purple-600 text-white' : 'bg-slate-700'}`}>
            {profile?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-medium truncate w-32" title={profile?.email}>{profile?.email || 'User'}</p>
            <p className="text-xs capitalize px-1.5 py-0.5 bg-slate-800 rounded inline-block border border-slate-600">
                {profile?.role || 'Viewer'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={signOut}
          className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-200 transition-colors text-xs font-medium"
        >
          <LogOut size={14} />
          <span>{t('nav.signout')}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
