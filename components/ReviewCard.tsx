
import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, CheckCircle, Clock, Sparkles, Languages, Smartphone, User, Edit2, Save, X, Tag } from 'lucide-react';
import { Review, Sentiment, ReplyTemplate, ReviewStatus } from '../types';
import { generateReplyDraft, translateText } from '../services/geminiService';
import { supabase, updateReviewStatus, updateReviewMetadata } from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';
import { TOPICS } from '../constants';

interface ReviewCardProps {
  review: Review;
  appName?: string;
  onReply: (id: number, content: string) => void;
  onUserClick: (userName: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, appName, onReply, onUserClick }) => {
  const { isAdmin } = useAuth();
  
  // UI States
  const [isReplying, setIsReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editTopics, setEditTopics] = useState<string[]>(review.topics || []);
  const [editSentiment, setEditSentiment] = useState<Sentiment>(review.sentiment);
  const [newTopicInput, setNewTopicInput] = useState('');

  // Status State
  const [status, setStatus] = useState<ReviewStatus>(review.status || 'pending');
  
  // Translation State
  const [translatedBody, setTranslatedBody] = useState<string | null>(review.translated_body || null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(!!review.translated_body);

  // Template State
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);

  useEffect(() => {
    if (isReplying) {
        supabase.from('reply_templates').select('*').then(({ data }) => {
            if (data) setTemplates(data as ReplyTemplate[]);
        });
    }
  }, [isReplying]);

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    const draft = await generateReplyDraft(review);
    setReplyDraft(draft);
    setIsGenerating(false);
  };

  const handleTranslate = async () => {
      if (showTranslation) {
          setShowTranslation(false); 
          return;
      }
      
      if (translatedBody) {
          setShowTranslation(true);
          return;
      }

      setIsTranslating(true);
      const text = await translateText(review.body);
      setTranslatedBody(text);
      setShowTranslation(true);
      setIsTranslating(false);

      if (text && text !== "Translation failed.") {
          await supabase.from('reviews').update({ translated_body: text }).eq('id', review.id);
      }
  };

  const handleStatusChange = async (newStatus: ReviewStatus) => {
      setStatus(newStatus);
      try {
          await updateReviewStatus(review.id, newStatus);
      } catch (e) {
          console.error("Failed to update status");
      }
  };

  const handleSaveEdit = async () => {
      try {
          await updateReviewMetadata(review.id, editTopics, editSentiment);
          setIsEditing(false);
          // In a real app, you might want to update the parent state or re-fetch, 
          // but for now we rely on local state which is fine for UX.
      } catch (e) {
          alert("Failed to save changes.");
      }
  };

  const toggleTopic = (topic: string) => {
      if (editTopics.includes(topic)) {
          setEditTopics(editTopics.filter(t => t !== topic));
      } else {
          setEditTopics([...editTopics, topic]);
      }
  };

  const getSentimentColor = (sentiment: Sentiment) => {
    switch (sentiment) {
      case Sentiment.Positive: return 'bg-green-100 text-green-700 border-green-200';
      case Sentiment.Negative: return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusColor = (s: ReviewStatus) => {
      switch(s) {
          case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
          case 'investigating': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'ignored': return 'bg-slate-100 text-slate-500 border-slate-200';
          default: return 'bg-orange-50 text-orange-600 border-orange-200';
      }
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 mb-4 transition-all hover:border-blue-200 group relative">
      
      {/* Edit Toggle (Visible on Hover for Admin) */}
      {isAdmin && !isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="absolute top-4 right-4 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
            title="Edit Analysis"
          >
              <Edit2 size={16} />
          </button>
      )}

      {/* Header Section */}
      <div className="flex justify-between items-start mb-3 pr-8">
        <div className="flex flex-col gap-1">
          {appName && (
            <div className="flex items-center text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit mb-1 border border-blue-100">
                <Smartphone size={10} className="mr-1" /> {appName}
            </div>
          )}
          <div className="flex items-center space-x-3">
            <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                <Star
                    key={i}
                    size={16}
                    fill={i < review.rating ? "currentColor" : "none"}
                    className={i < review.rating ? "text-yellow-400" : "text-slate-300"}
                />
                ))}
            </div>
            <span className="font-bold text-slate-800 line-clamp-1">{review.title}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Dropdown */}
          <select 
            className={`text-xs px-2 py-1 rounded-full border font-medium uppercase cursor-pointer outline-none focus:ring-2 ring-offset-1 ${getStatusColor(status)}`}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as ReviewStatus)}
            disabled={!isAdmin}
          >
              <option value="pending">Pending</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
          </select>
          
          {/* Sentiment Badge (Editable) */}
          {isEditing ? (
              <select 
                 value={editSentiment} 
                 onChange={e => setEditSentiment(e.target.value as Sentiment)}
                 className="text-xs border rounded px-1 py-0.5 bg-white"
              >
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
              </select>
          ) : (
            <span className={`text-xs px-2 py-1 rounded-full border font-medium uppercase ${getSentimentColor(review.sentiment)}`}>
                {review.sentiment}
            </span>
          )}
          
          <span className="text-slate-400 text-xs flex items-center whitespace-nowrap">
             <Clock size={12} className="mr-1" />
             {new Date(review.created_at_store).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Body Section */}
      <div className="relative mb-3">
        <p className="text-slate-600 text-sm mb-2 leading-relaxed whitespace-pre-wrap">
            {review.body}
        </p>
        
        {showTranslation && translatedBody && (
            <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 text-slate-700 text-sm animate-in fade-in">
                <div className="flex items-center text-blue-600 text-xs font-bold mb-1">
                    <Languages size={12} className="mr-1" /> AI Translation (中文):
                </div>
                {translatedBody}
            </div>
        )}
      </div>

      {/* Metadata & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Topic Tags */}
            {isEditing ? (
                <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                    {editTopics.map(topic => (
                        <button key={topic} onClick={() => toggleTopic(topic)} className="bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 px-2 py-1 rounded-md text-xs font-medium border border-slate-300 flex items-center group">
                            #{topic} <X size={10} className="ml-1 opacity-50 group-hover:opacity-100" />
                        </button>
                    ))}
                    <div className="flex items-center">
                        <input 
                            type="text" 
                            className="text-xs border-b border-slate-300 bg-transparent focus:border-blue-500 outline-none w-20"
                            placeholder="+ Add topic"
                            value={newTopicInput}
                            onChange={(e) => setNewTopicInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTopicInput) {
                                    if(!editTopics.includes(newTopicInput)) setEditTopics([...editTopics, newTopicInput]);
                                    setNewTopicInput('');
                                    e.preventDefault();
                                }
                            }}
                        />
                    </div>
                </div>
            ) : (
                review.topics?.map(topic => (
                    <span key={topic} className="bg-slate-50 text-slate-600 px-2 py-1 rounded-md text-xs font-medium border border-slate-200">
                        #{topic}
                    </span>
                ))
            )}
            
            {!isEditing && (
                <>
                    <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-md text-xs font-medium border border-slate-200 uppercase">
                    {review.territory}
                    </span>
                    <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-md text-xs font-medium border border-slate-200">
                    v{review.app_version}
                    </span>
                </>
            )}
          </div>

          <div className="flex items-center gap-3">
             {/* Edit Save Actions */}
             {isEditing ? (
                 <div className="flex space-x-2">
                     <button onClick={() => setIsEditing(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                     <button onClick={handleSaveEdit} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md flex items-center hover:bg-blue-700">
                         <Save size={12} className="mr-1" /> Save
                     </button>
                 </div>
             ) : (
                <button 
                    onClick={handleTranslate} 
                    disabled={isTranslating}
                    className="text-xs flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                >
                    <Languages size={14} className="mr-1" />
                    {isTranslating ? 'Translating...' : (showTranslation ? 'Hide Translation' : 'Translate')}
                </button>
             )}
          </div>
      </div>

      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
             onClick={() => onUserClick(review.user_name)}
             className="text-xs text-slate-500 font-medium flex items-center hover:text-blue-600 hover:underline transition-colors group"
             title="View User History"
          >
            <User size={12} className="mr-1 group-hover:text-blue-600" />
            by {review.user_name}
          </button>
          
          {review.is_edited && (
            <span className="text-xs text-orange-500 font-medium">Edited</span>
          )}
        </div>

        {!review.replied_at && !isReplying && isAdmin && (
          <button
            onClick={() => setIsReplying(true)}
            className="text-blue-600 text-sm font-medium hover:text-blue-700 flex items-center"
          >
            <MessageCircle size={16} className="mr-1" />
            Reply
          </button>
        )}
      </div>

      {/* Reply Section */}
      {isReplying && (
        <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-2">
             <h4 className="text-sm font-semibold text-slate-700">Draft Reply</h4>
             <div className="flex space-x-2">
                {templates.length > 0 && (
                    <select 
                        className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
                        onChange={(e) => {
                            const t = templates.find(temp => temp.id === Number(e.target.value));
                            if(t) setReplyDraft(t.content);
                        }}
                        defaultValue=""
                    >
                        <option value="" disabled>Insert Template...</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                )}

                <button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-full flex items-center hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                <Sparkles size={12} className="mr-1" />
                Auto-Generate
                </button>
             </div>
          </div>
          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            className="w-full p-3 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none mb-3"
            rows={4}
            placeholder="Write your response here..."
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsReplying(false)}
              className="px-3 py-1.5 text-slate-600 text-sm hover:bg-slate-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onReply(review.id, replyDraft);
                setIsReplying(false);
              }}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              Send Reply
            </button>
          </div>
        </div>
      )}

      {review.replied_at && (
        <div className="mt-4 bg-green-50 p-3 rounded-lg border border-green-100">
          <div className="flex items-center text-green-700 text-xs font-bold mb-1">
            <CheckCircle size={12} className="mr-1" />
            Replied on {new Date().toLocaleDateString()}
          </div>
          <p className="text-slate-600 text-sm italic">
            "{review.reply_content || "Thank you for your feedback!"}"
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewCard;
