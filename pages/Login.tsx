
import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, Loader2, AlertCircle, PlayCircle } from 'lucide-react';

interface LoginProps {
  onToggleMode: () => void;
}

const Login: React.FC<LoginProps> = ({ onToggleMode }) => {
  const { loginWithDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <Lock className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
          <p className="text-slate-500 mt-2">Sign in to access your App Store Monitor</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center text-sm mb-6 border border-red-100">
            <AlertCircle size={16} className="mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        {!isConfigured && (
            <div className="bg-orange-50 text-orange-700 p-4 rounded-lg mb-6 border border-orange-200 text-sm">
                <div className="flex items-start mb-2">
                    <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
                    <strong>Supabase Not Configured</strong>
                </div>
                <p className="mb-3">
                    The app is running without a database connection. Real authentication is disabled.
                </p>
                <button 
                    onClick={loginWithDemo}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center"
                >
                    <PlayCircle size={18} className="mr-2" />
                    Enter Demo Mode (Admin)
                </button>
            </div>
        )}

        {isConfigured && (
            <form onSubmit={handleLogin} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="you@company.com"
                />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-blue-200 flex items-center justify-center"
            >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </button>
            </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Don't have an account?{' '}
            <button onClick={onToggleMode} className="text-blue-600 font-medium hover:underline">
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
