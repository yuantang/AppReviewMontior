
import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseService';
import { UserPlus, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

interface RegisterProps {
  onToggleMode: () => void;
}

const Register: React.FC<RegisterProps> = ({ onToggleMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
        setError("Supabase is not configured. Registration is disabled.");
        return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      alert('Registration successful! You can now log in.');
      onToggleMode();
    }
    setLoading(false);
  };

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-slate-800 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-slate-200">
            <UserPlus className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Create Account</h1>
          <p className="text-slate-500 mt-2">Join the App Store Monitor</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center text-sm mb-6 border border-red-100">
            <AlertCircle size={16} className="mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        {!isConfigured && (
            <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg mb-6 border border-yellow-200 text-sm">
                <div className="flex items-start">
                    <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                        <strong>Registration Unavailable</strong>
                        <p className="mt-1">
                            The database is not connected. Please ask the administrator to configure the backend or return to Login to enter <strong>Demo Mode</strong>.
                        </p>
                    </div>
                </div>
            </div>
        )}

        {isConfigured && (
            <form onSubmit={handleRegister} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-500 outline-none transition-all"
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
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                    placeholder="Min 6 characters"
                    minLength={6}
                />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-slate-200 flex items-center justify-center"
            >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign Up'}
            </button>
            </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <button onClick={onToggleMode} className="text-blue-600 font-medium hover:underline">
              Log In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
