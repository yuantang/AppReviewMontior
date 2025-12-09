
import React, { useEffect, useState } from 'react';
import { X, Star, Calendar, Loader2, Smartphone } from 'lucide-react';
import { fetchUserReviewHistory } from '../services/supabaseService';
import { Review } from '../types';

interface UserHistoryModalProps {
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

const UserHistoryModal: React.FC<UserHistoryModalProps> = ({ userName, isOpen, onClose }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userName) {
      setLoading(true);
      fetchUserReviewHistory(userName).then((data) => {
        setHistory(data);
        setLoading(false);
      });
    }
  }, [isOpen, userName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div>
             <h3 className="text-lg font-bold text-slate-800">User Profile</h3>
             <p className="text-slate-500 text-sm">History for <span className="font-semibold text-blue-600">{userName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 bg-slate-50/50 flex-1">
          {loading ? (
             <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
             <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
                {history.map((review, idx) => (
                   <div key={review.id} className="ml-6 relative">
                      {/* Timeline Dot */}
                      <span className={`absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                          review.rating >= 4 ? 'bg-green-500' : review.rating <= 2 ? 'bg-red-500' : 'bg-yellow-400'
                      }`} />
                      
                      <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                         <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center space-x-2">
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium border border-slate-200 flex items-center">
                                    <Smartphone size={10} className="mr-1" />
                                    {review.apps?.name || 'Unknown App'}
                                </span>
                                <div className="flex text-yellow-400">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} />
                                    ))}
                                </div>
                            </div>
                            <span className="text-xs text-slate-400 flex items-center">
                                <Calendar size={12} className="mr-1" />
                                {new Date(review.created_at_store).toLocaleDateString()}
                            </span>
                         </div>
                         <h4 className="font-bold text-sm text-slate-800 mb-1">{review.title}</h4>
                         <p className="text-sm text-slate-600 leading-relaxed">"{review.body}"</p>
                         {review.replied_at && (
                             <div className="mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded w-fit">
                                 ✅ Replied
                             </div>
                         )}
                      </div>
                   </div>
                ))}
                {history.length === 0 && <p className="text-center text-slate-400 italic">No history found.</p>}
             </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white rounded-b-xl flex justify-between items-center text-xs text-slate-400">
             <span>Total Reviews: {history.length}</span>
             <span>Avg Rating: {history.length > 0 ? (history.reduce((a,b)=>a+b.rating,0)/history.length).toFixed(1) : 0}</span>
        </div>
      </div>
    </div>
  );
};

export default UserHistoryModal;
