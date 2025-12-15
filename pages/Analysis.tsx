
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { Sparkles, BrainCircuit, Filter, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabaseService';
import { AppProduct, Review } from '../types';
import { TOPICS } from '../constants';
import { generateAnalysisReport } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';

// Simple in-memory cache to avoid refetch on tab switch
let cachedReviews: Review[] = [];
let cachedApps: AppProduct[] = [];

const Analysis: React.FC = () => {
  const { t } = useLanguage();
  const { session } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [apps, setApps] = useState<AppProduct[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>('all');
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: defaultFrom,
    to: new Date(),
    label: 'Last 30 Days'
  });
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: defaultFrom,
    to: new Date(),
    label: 'Last 30 Days'
  });
  const [loading, setLoading] = useState(false);
  
  // AI Report State
  const [report, setReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // 1. Fetch Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (cachedReviews.length > 0 || cachedApps.length > 0) {
        setReviews(cachedReviews);
        setApps(cachedApps);
        setLoading(false);
        return;
      }

      if (isSupabaseConfigured()) {
        try {
          const authHeader = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined;
          const [reviewsRes, appsRes] = await Promise.all([
            axios.post('/api/admin', { action: 'list_reviews' }, { headers: authHeader }),
            axios.post('/api/admin', { action: 'list_apps' }, { headers: authHeader })
          ]);
          const dbReviews = reviewsRes.data?.reviews || [];
          const dbApps = appsRes.data?.apps || [];
          setReviews(dbReviews);
          setApps(dbApps);
          cachedReviews = dbReviews;
          cachedApps = dbApps;
        } catch (e) {
          console.error("Analysis load error", e);
          setReviews([]);
          setApps([]);
        }
      } else {
        setReviews([]);
        setApps([]);
      }
      setLoading(false);
    };
    loadData();
  }, [session]);

  const stripMd = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^##\s*/g, '')
      .replace(/^#\s*/g, '')
      .trim();

  const renderReport = (text: string | null) => {
    if (!text) return null;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const blocks: JSX.Element[] = [];
    let listBuffer: string[] = [];

    const flushList = () => {
      if (listBuffer.length === 0) return;
      blocks.push(
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700" key={`ul-${blocks.length}`}>
          {listBuffer.map((item, idx) => <li key={idx}>{stripMd(item)}</li>)}
        </ul>
      );
      listBuffer = [];
    };

    lines.forEach((line, idx) => {
      if (line.startsWith('## ')) {
        flushList();
        blocks.push(
          <h4 className="text-base font-semibold text-slate-900" key={`h-${idx}`}>
            {stripMd(line)}
          </h4>
        );
      } else if (/^(\*|-)\s+/.test(line)) {
        listBuffer.push(line.replace(/^(\*|-)\s+/, ''));
      } else {
        flushList();
        blocks.push(
          <p className="text-sm text-slate-700 leading-6" key={`p-${idx}`}>
            {stripMd(line)}
          </p>
        );
      }
    });
    flushList();
    return blocks;
  };

  // 2. Filter Reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      const matchApp = selectedAppId === 'all' || r.app_id === selectedAppId;
      let matchTime = true;
      if (dateRange.from && dateRange.to) {
        const d = new Date(r.created_at_store);
        matchTime = d >= dateRange.from && d <= dateRange.to;
      }
      return matchApp && matchTime;
    });
  }, [reviews, selectedAppId, dateRange]);

  // --- AI Report Generation ---
  const handleGenerateReport = async () => {
      setGeneratingReport(true);
      
      const stats = {
          total: filteredReviews.length,
          avg: (filteredReviews.reduce((a,b)=>a+b.rating,0) / filteredReviews.length || 0).toFixed(1),
          positive: filteredReviews.filter(r => r.sentiment === 'positive').length,
          neutral: filteredReviews.filter(r => r.sentiment === 'neutral').length,
          negative: filteredReviews.filter(r => r.sentiment === 'negative').length,
          topics: TOPICS.slice(0, 3), // Simplified for prompt
          lang: t('lang.code') || 'en' // optional language hint from i18n
      };

      const text = await generateAnalysisReport(stats);
      setReport(text);
      setGeneratingReport(false);
  };

  // --- Dynamic Calculations ---

  // A. Sentiment Trend (Over Time) - Grouped by Date
  const sentimentTrend = useMemo(() => {
    const map = new Map<string, { positive: number, negative: number, neutral: number }>();
    
    // Sort reviews by date
    const sorted = [...filteredReviews].sort((a, b) => new Date(a.created_at_store).getTime() - new Date(b.created_at_store).getTime());

    sorted.forEach(r => {
        const date = new Date(r.created_at_store).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const curr = map.get(date) || { positive: 0, negative: 0, neutral: 0 };
        
        if (r.sentiment === 'positive') curr.positive++;
        else if (r.sentiment === 'negative') curr.negative++;
        else curr.neutral++;
        
        map.set(date, curr);
    });

    return Array.from(map.entries()).map(([date, counts]) => ({
        date,
        ...counts
    })).slice(-14); // Last 14 data points
  }, [filteredReviews]);

  // B. Topic Impact (Impact on Rating)
  // Calculate: (Avg Rating of reviews with Topic) - (Global Avg Rating)
  const topicImpact = useMemo(() => {
      const globalAvg = filteredReviews.reduce((a,b)=>a+b.rating,0) / filteredReviews.length || 0;
      
      return TOPICS.map(topic => {
          const topicReviews = filteredReviews.filter(r => r.topics?.includes(topic));
          if (topicReviews.length === 0) return null;
          
          const topicAvg = topicReviews.reduce((a,b)=>a+b.rating,0) / topicReviews.length;
          const impact = topicAvg - globalAvg;
          
          return {
              topic,
              impact: parseFloat(impact.toFixed(2)),
              count: topicReviews.length
          };
      }).filter(Boolean).sort((a,b) => (a?.impact || 0) - (b?.impact || 0)); // Sort by impact
  }, [filteredReviews]);

  // C. Version Satisfaction (Existing)
  const versionSatisfaction = useMemo(() => {
    const map = new Map<string, { sum: number, count: number }>();
    filteredReviews.forEach(r => {
      const v = r.app_version || 'Unknown';
      const curr = map.get(v) || { sum: 0, count: 0 };
      map.set(v, { sum: curr.sum + r.rating, count: curr.count + 1 });
    });
    return Array.from(map.entries()).map(([version, val]) => ({
      version,
      rating: parseFloat((val.sum / val.count).toFixed(1)),
      count: val.count
    })).sort((a, b) => b.version.localeCompare(a.version)).slice(0, 8);
  }, [filteredReviews]);

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <BrainCircuit className="mr-3 text-purple-600" size={28} />
            {t('analysis.title')}
          </h1>
          <p className="text-slate-500 mt-1">
            {t('analysis.subtitle').replace('{count}', String(filteredReviews.length))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-slate-400 ml-2" />
            <select 
              className="appearance-none bg-transparent border-none text-slate-700 text-sm pl-2 pr-8 py-1.5 focus:ring-0 outline-none cursor-pointer font-medium"
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">{t('common.all_apps')}</option>
              {apps.map(app => (
                  <option key={app.id} value={app.id}>{app.name}</option>
              ))}
            </select>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
             <Loader2 className="animate-spin text-purple-600" size={32} />
        </div>
      ) : (
        <div className="space-y-8">
            
            {/* 1. AI Executive Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-white p-6 rounded-xl border border-purple-100 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-2">
                        <div className="bg-purple-600 p-2 rounded-lg text-white">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{t('analysis.exec_summary')}</h3>
                            <p className="text-xs text-slate-500">{t('analysis.exec_summary_desc')}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleGenerateReport} 
                        disabled={generatingReport}
                        className="text-sm bg-white border border-purple-200 text-purple-700 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors flex items-center shadow-sm"
                    >
                        {generatingReport ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles size={16} className="mr-2" />}
                        {report ? t('analysis.regenerate_report') : t('analysis.generate_report')}
                    </button>
                </div>
                
                {report ? (
                    <div className="bg-white p-4 rounded-lg border border-purple-50/50 space-y-2">
                        {renderReport(report)}
                    </div>
                ) : (
                    <div className="text-center py-6 text-slate-400 text-sm italic border-2 border-dashed border-purple-100 rounded-lg">
                        {t('analysis.empty_report')}
                    </div>
                )}
            </div>

            {/* 2. Sentiment Trend & Topic Impact */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Sentiment Trend */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                        <TrendingUp className="mr-2 text-blue-500" size={20} /> {t('analysis.sentiment_trend')}
                    </h3>
                    <p className="text-sm text-slate-400 mb-6">{t('analysis.sentiment_trend_desc')}</p>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sentimentTrend}>
                                <defs>
                                    <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <RechartsTooltip contentStyle={{borderRadius: '8px', border:'none'}} />
                                <Area type="monotone" dataKey="positive" stroke="#22c55e" fillOpacity={1} fill="url(#colorPos)" stackId="1" />
                                <Area type="monotone" dataKey="negative" stroke="#ef4444" fillOpacity={1} fill="url(#colorNeg)" stackId="1" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Topic Impact */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                        <AlertTriangle className="mr-2 text-orange-500" size={20} /> {t('analysis.impact_analysis')}
                    </h3>
                    <p className="text-sm text-slate-400 mb-6">{t('analysis.impact_desc')}</p>
                    <div className="h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {topicImpact?.map((item: any, idx) => (
                            <div key={idx} className="mb-4">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium text-slate-700 capitalize">#{item.topic}</span>
                                    <span className={`text-xs font-bold ${item.impact < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {item.impact > 0 ? '+' : ''}{item.impact} stars
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 relative">
                                    <div 
                                        className={`h-2 rounded-full ${item.impact < 0 ? 'bg-red-400' : 'bg-green-400'}`}
                                        style={{ width: `${Math.min(Math.abs(item.impact) * 20, 100)}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 text-right">{item.count} reviews</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. Version Satisfaction (Bottom Row) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-2">{t('analysis.version_score')}</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={versionSatisfaction}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="version" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                            <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                            <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                            <Bar dataKey="rating" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Analysis;
