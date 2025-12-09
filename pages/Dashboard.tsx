
import React, { useEffect, useState, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { Activity, Star, AlertTriangle, ThumbsDown, ArrowRight, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';
import { Skeleton, CardSkeleton, ChartSkeleton } from '../components/Skeleton';
import { MOCK_REVIEWS, TOPICS } from '../constants';
import { fetchReviewsFromDB, fetchAppsFromDB, isSupabaseConfigured } from '../services/supabaseService';
import { Review, AppProduct } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const Dashboard: React.FC = () => {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [apps, setApps] = useState<AppProduct[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date Range State (Default to Last 30 Days)
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: defaultFrom,
    to: new Date(),
    label: 'Last 30 Days'
  });

  // App Filter State
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (isSupabaseConfigured()) {
        try {
          const [reviewsData, appsData] = await Promise.all([
             fetchReviewsFromDB(),
             fetchAppsFromDB()
          ]);

          if (reviewsData && reviewsData.length > 0) setReviews(reviewsData);
          else setReviews(MOCK_REVIEWS); // Fallback to mock if DB empty
          
          if (appsData) setApps(appsData);
        } catch (e) {
          console.log("Using mock data for dashboard");
          setReviews(MOCK_REVIEWS);
        }
      } else {
        setReviews(MOCK_REVIEWS);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Filter Data based on Time Range and App
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      const reviewDate = new Date(r.created_at_store);
      
      // 1. Time Filter
      let matchTime = true;
      if (dateRange.from && dateRange.to) {
        matchTime = reviewDate >= dateRange.from && reviewDate <= dateRange.to;
      }

      // 2. App Filter
      let matchApp = true;
      if (selectedAppId !== 'all') {
        matchApp = r.app_id === selectedAppId;
      }

      return matchTime && matchApp;
    });
  }, [reviews, dateRange, selectedAppId]);

  // --- Aggregations ---
  const totalReviews = filteredReviews.length;
  const avgRating = totalReviews > 0 
    ? (filteredReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1) 
    : "0.0";
  const negativeCount = filteredReviews.filter(r => r.rating <= 2).length;
  const criticalIssues = filteredReviews.filter(r => r.topics?.includes('crash') || r.topics?.includes('bug')).length;

  // 1. Sentiment Distribution
  const sentimentCounts = filteredReviews.reduce((acc, r) => {
    const s = r.sentiment || 'neutral';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sentimentData = [
    { name: 'Positive', value: sentimentCounts['positive'] || 0, color: '#22c55e' },
    { name: 'Neutral', value: sentimentCounts['neutral'] || 0, color: '#94a3b8' },
    { name: 'Negative', value: sentimentCounts['negative'] || 0, color: '#ef4444' },
  ];

  // 2. Star Rating Distribution (1-5 Stars)
  const starCounts = Array(5).fill(0).map((_, i) => ({
    stars: 5 - i,
    count: filteredReviews.filter(r => r.rating === 5 - i).length,
    percentage: totalReviews > 0 ? (filteredReviews.filter(r => r.rating === 5 - i).length / totalReviews) * 100 : 0
  }));

  // 3. Topic Data
  const topicData = TOPICS.map(t => ({
    name: t,
    count: filteredReviews.filter(r => r.topics?.includes(t)).length
  })).sort((a, b) => b.count - a.count).slice(0, 6);

  // 4. Trend Data (Grouped by Date)
  const trendMap = useMemo(() => {
    const map = new Map<string, { sum: number, count: number }>();
    filteredReviews.forEach(r => {
        const dateKey = new Date(r.created_at_store).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const curr = map.get(dateKey) || { sum: 0, count: 0 };
        map.set(dateKey, { sum: curr.sum + r.rating, count: curr.count + 1 });
    });

    return Array.from(map.entries()).map(([name, val]) => ({
        name,
        rating: parseFloat((val.sum / val.count).toFixed(1)),
        volume: val.count
    })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  }, [filteredReviews]);
  
  const finalTrendData = trendMap.length > 0 ? trendMap : [{ name: 'No Data', rating: 0, volume: 0 }];

  // 5. Recent Reviews
  const recentReviews = filteredReviews.slice(0, 5);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('dash.title')}</h1>
          <p className="text-slate-500 mt-1">
            {loading ? t('common.loading') : t('dash.subtitle')}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           {/* App Selector */}
           <div className="relative">
             <select 
                className="appearance-none bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg pl-3 pr-8 py-2 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
             >
                <option value="all">{t('common.all_apps')}</option>
                {apps.map(app => (
                    <option key={app.id} value={app.id}>{app.name}</option>
                ))}
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
               <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
             </div>
           </div>

           {/* Date Range Picker */}
           <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
            <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </>
        ) : (
            <>
                <StatCard title={t('dash.total_reviews')} value={totalReviews} icon={Activity} />
                <StatCard title={t('dash.avg_rating')} value={avgRating} icon={Star} color="yellow" />
                <StatCard title={t('dash.negative_reviews')} value={negativeCount} icon={ThumbsDown} color="red" />
                <StatCard title={t('dash.critical_issues')} value={criticalIssues} icon={AlertTriangle} color="orange" />
            </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Trend Chart */}
        <div className="lg:col-span-2">
            {loading ? <ChartSkeleton /> : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-96">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">{t('dash.trend_volume')}</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={finalTrendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                            <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" axisLine={false} tickLine={false} domain={[0, 5]} />
                            <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" axisLine={false} tickLine={false} />
                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Line yAxisId="left" type="monotone" dataKey="rating" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                            <Line yAxisId="right" type="monotone" dataKey="volume" stroke="#94a3b8" strokeDasharray="5 5" />
                        </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>

        {/* Rating Distribution (1-5 Stars) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-96">
          <h3 className="text-lg font-bold text-slate-800 mb-6">{t('dash.rating_dist')}</h3>
          {loading ? (
             <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
             </div>
          ) : (
            <div className="space-y-4">
               {starCounts.map((item) => (
                   <div key={item.stars} className="flex items-center space-x-3">
                       <span className="text-sm font-medium text-slate-600 w-3">{item.stars}</span>
                       <Star size={14} className="text-yellow-400 fill-yellow-400" />
                       <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                             style={{ width: `${item.percentage}%` }}
                           ></div>
                       </div>
                       <span className="text-xs text-slate-400 w-8 text-right">{item.count}</span>
                   </div>
               ))}
               <div className="pt-6 border-t border-slate-50 mt-4 flex justify-between items-center">
                   <div className="text-center">
                       <p className="text-3xl font-bold text-slate-800">{avgRating}</p>
                       <div className="flex justify-center text-yellow-400 mt-1">
                           {[...Array(5)].map((_,i) => <Star key={i} size={12} fill={i < Math.round(Number(avgRating)) ? "currentColor" : "none"} />)}
                       </div>
                       <p className="text-xs text-slate-400 mt-1">{t('dash.avg_rating')}</p>
                   </div>
                   <div className="h-12 w-px bg-slate-200"></div>
                   <div className="text-center">
                       <p className="text-3xl font-bold text-green-600">{Math.round((sentimentCounts['positive'] || 0) / totalReviews * 100 || 0)}%</p>
                       <p className="text-xs text-slate-400 mt-2">Positive Sentiment</p>
                   </div>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Topics Bar Chart */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">{t('dash.top_topics')}</h3>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12}} width={100} />
                    <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
                </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent Reviews Feed */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">{t('dash.recent_activity')}</h3>
                <Link to="/reviews" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center">
                    {t('dash.view_all')} <ArrowRight size={14} className="ml-1" />
                </Link>
            </div>
            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : (
                <div className="space-y-4">
                    {recentReviews.map(r => (
                        <div key={r.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-100 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center space-x-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase ${
                                        r.sentiment === 'positive' ? 'bg-green-100 text-green-700 border-green-200' : 
                                        r.sentiment === 'negative' ? 'bg-red-100 text-red-700 border-red-200' : 
                                        'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                        {r.rating} ★
                                    </span>
                                    <span className="font-medium text-sm text-slate-800 truncate w-40">{r.title}</span>
                                </div>
                                <span className="text-xs text-slate-400">{new Date(r.created_at_store).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 mb-2">{r.body}</p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-400">by {r.user_name}</span>
                                {r.need_reply && !r.replied_at && (
                                    <Link to="/reviews" className="text-xs text-blue-600 flex items-center hover:underline">
                                        <MessageSquare size={12} className="mr-1" /> Reply
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                    {recentReviews.length === 0 && <p className="text-center text-slate-400 text-sm py-4">{t('dash.no_data')}</p>}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
