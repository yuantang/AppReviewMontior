
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ReviewList from './pages/ReviewList';
import Settings from './pages/Settings';
import Apps from './pages/Apps';
import Analysis from './pages/Analysis';
import Login from './pages/Login';
import Register from './pages/Register';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import LanguageSwitcher from './components/LanguageSwitcher';

const AppContent: React.FC = () => {
  const { session, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin mr-2" />
        <span>Loading session...</span>
      </div>
    );
  }

  // If not logged in, show Auth screens
  if (!session) {
    if (authMode === 'login') {
      return <Login onToggleMode={() => setAuthMode('register')} />;
    } else {
      return <Register onToggleMode={() => setAuthMode('login')} />;
    }
  }

  // Logged in: Show Main App
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'reviews':
        return <ReviewList />;
      case 'analysis':
        return <Analysis />;
      case 'apps':
        return <Apps />;
      case 'settings':
         return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 ml-64 flex flex-col h-screen bg-[#f8fafc]">
         {/* Top Header */}
         <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-8 shadow-sm z-10 shrink-0">
            <div className="flex items-center space-x-3">
               <LanguageSwitcher />
            </div>
         </header>

         {/* Scrollable Content Area */}
         <div className="flex-1 overflow-auto p-0">
            {renderContent()}
         </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
