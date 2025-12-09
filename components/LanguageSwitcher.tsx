
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center bg-slate-100/50 border border-slate-200 rounded-lg p-1">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
          language === 'en' 
            ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        English
      </button>
      <button
        onClick={() => setLanguage('zh')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
          language === 'zh' 
            ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        中文
      </button>
    </div>
  );
};

export default LanguageSwitcher;
