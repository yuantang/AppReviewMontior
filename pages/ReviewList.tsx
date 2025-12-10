
import React, { useState, useMemo, useEffect } from 'react';
import { Filter, Download, Search, RefreshCw, CheckCircle2 } from 'lucide-react';
import ReviewCard from '../components/ReviewCard';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';
import UserHistoryModal from '../components/UserHistoryModal';
import { MOCK_REVIEWS, MOCK_APPS } from '../constants';
import { fetchReviewsFromDB, fetchAppsFromDB, isSupabaseConfigured } from '../services/supabaseService';
import { Review, AppProduct, ReviewStatus } from '../types';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ReviewList: React.FC = () => {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [apps, setApps] = useState<AppProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  // Filters
  const [selectedApp, setSelectedApp] = useState<number | 'all'>('all');
  const [filterRating, setFilterRating] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all'); // New Status Filter
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Range State
  const [dateRange, setDateRange] = useState<DateRange>({
    from: null,
    to: null,
    label: 'All Time'
  });

  // User History Modal State
  const [historyModalUser, setHistoryModalUser] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    
    try {
      if (isSupabaseConfigured()) {
        const tokenRes = await axios.post('/api/admin', { action: 'list_reviews' }, { headers: { Authorization: `Bearer ${session?.access_token}` } });
        const appsRes = await axios.post('/api/admin', { action: 'list_apps' }, { headers: { Authorization: `Bearer ${session?.access_token}` } });

        const dbReviews = tokenRes.data?.reviews || [];
        const dbApps = appsRes.data?.apps || [];

        if (dbReviews.length > 0) {
          setReviews(dbReviews);
          setApps(dbApps);
          setUsingMockData(false);
        } else {
          setReviews(MOCK_REVIEWS);
          setApps(dbApps.length > 0 ? dbApps : MOCK_APPS);
          setUsingMockData(true);
        }
      } else {
        setReviews(MOCK_REVIEWS);
        setApps(MOCK_APPS);
        setUsingMockData(true);
      }
    } catch (e) {
      console.error("Failed to load DB data", e);
      setReviews(MOCK_REVIEWS);
      setApps(MOCK_APPS);
      setUsingMockData(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReply = async (reviewIdStr: string | number, content: string) => {
    if (!isAdmin) {
        alert("You do not have permission to reply.");
        return;
    }

    const reviewId = String(reviewIdStr); 
    
    setReviews(prev => prev.map(r => 
      String(r.id) === reviewId || r.review_id === reviewId
        ? { ...r, replied_at: new Date().toISOString(), reply_content: content, status: 'resolved', need_reply: false } 
        : r
    ));

    if (!usingMockData && isSupabaseConfigured()) {
       try {
         const targetReview = reviews.find(r => String(r.id) === reviewId || r.review_id === reviewId);
         if (!targetReview) return;

         await axios.post('/api/reply', {
           reviewId: targetReview.review_id,
           replyText: content,
           appId: targetReview.app_id
         });
       } catch (error) {
         console.error("Failed to send reply via API", error);
         alert("Failed to send reply to App Store. See console for details.");
       }
    } else {
      console.log("Mock Reply Sent:", content);
    }
  };

  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      const matchApp = selectedApp === 'all' || r.app_id === selectedApp;
      const matchRating = filterRating === 'all' || r.rating === filterRating;
      
      // Default to 'pending' if status undefined in mock/legacy data
      const currentStatus = r.status || 'pending';
      const matchStatus = filterStatus === 'all' || currentStatus === filterStatus;

      const matchSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.topics?.some(t => t.includes(searchTerm.toLowerCase())) ||
                          r.user_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchTime = true;
      if (dateRange.from && dateRange.to) {
        const rDate = new Date(r.created_at_store);
        matchTime = rDate >= dateRange.from && rDate <= dateRange.to;
      }

      return matchApp && matchRating && matchStatus && matchSearch && matchTime;
    });
  }, [reviews, selectedApp, filterRating, filterStatus, searchTerm, dateRange]);

  return (
    <div className="p-8 max-w-5xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {usingMockData && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>{t('reviews.demo_mode')}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('reviews.title')}</h1>
          <p className="text-slate-500 mt-1">{t('reviews.subtitle')}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title={t('reviews.refresh')}
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Download size={16} />
            <span>{t('reviews.export')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-col xl:flex-row gap-4 items-start xl:items-center">
        <div className="relative flex-1 w-full xl:w-auto">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('reviews.search_placeholder')} 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center space-x-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <Filter size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-600">{t('reviews.filter_label')}</span>
          </div>

          <select 
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2 focus:border-blue-500 outline-none"
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">{t('reviews.filter_apps_all')}</option>
            {apps.map(app => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>
          
          {/* Status Filter */}
          <select 
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2 focus:border-blue-500 outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ReviewStatus | 'all')}
          >
            <option value="all">{t('reviews.filter_status_all')}</option>
            <option value="pending">Pending</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>

          <select 
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2 focus:border-blue-500 outline-none"
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">{t('reviews.filter_rating_all')}</option>
            <option value={5}>5 Stars</option>
            <option value={4}>4 Stars</option>
            <option value={3}>3 Stars</option>
            <option value={2}>2 Stars</option>
            <option value={1}>1 Star</option>
          </select>

          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-20">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredReviews.length > 0 ? (
          filteredReviews.map(review => {
            const app = apps.find(a => a.id === review.app_id);
            return (
              <ReviewCard 
                  key={review.id} 
                  review={review} 
                  appName={app?.name}
                  onReply={(id, content) => isAdmin ? handleReply(id, content) : alert("View only mode")} 
                  onUserClick={(name) => setHistoryModalUser(name)}
              />
            );
          })
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
             <div className="mx-auto w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-3">
               <Filter size={24} className="text-slate-400" />
             </div>
             <h3 className="text-slate-600 font-medium">{t('reviews.empty_title')}</h3>
             <p className="text-slate-400 text-sm mt-1">
               {usingMockData ? t('reviews.empty_desc') : t('reviews.empty_desc')}
             </p>
          </div>
        )}
      </div>

      {/* User History Modal */}
      <UserHistoryModal 
         isOpen={!!historyModalUser} 
         userName={historyModalUser || ''} 
         onClose={() => setHistoryModalUser(null)} 
      />
    </div>
  );
};

export default ReviewList;
