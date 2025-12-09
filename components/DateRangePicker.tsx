
import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

export interface DateRange {
  from: Date | null;
  to: Date | null;
  label?: string; // e.g. "Last 7 Days"
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Local state for the inputs while the dropdown is open
  const [localFrom, setLocalFrom] = useState<string>(value.from ? value.from.toISOString().split('T')[0] : '');
  const [localTo, setLocalTo] = useState<string>(value.to ? value.to.toISOString().split('T')[0] : '');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update local state when prop value changes
  useEffect(() => {
    setLocalFrom(value.from ? value.from.toISOString().split('T')[0] : '');
    setLocalTo(value.to ? value.to.toISOString().split('T')[0] : '');
  }, [value]);

  const presets = [
    { label: 'Today', days: 0 },
    { label: 'Yesterday', days: 1, offset: 1 }, // offset means shift window back
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 14 Days', days: 14 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 90 Days', days: 90 },
    { label: 'This Year', custom: 'year' },
    { label: 'All Time', custom: 'all' },
  ];

  const handlePresetClick = (preset: any) => {
    const to = new Date();
    const from = new Date();

    if (preset.custom === 'all') {
      onChange({ from: null, to: null, label: 'All Time' });
      setIsOpen(false);
      return;
    }

    if (preset.custom === 'year') {
      from.setMonth(0, 1); // Jan 1st
      from.setHours(0, 0, 0, 0);
      // to is now
    } else if (preset.offset) {
      // e.g. Yesterday: from = now - 1, to = now - 1
      to.setDate(to.getDate() - preset.offset);
      from.setDate(from.getDate() - preset.offset);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
    } else {
      // e.g. Last 7 days: from = now - 7
      from.setDate(from.getDate() - (preset.days - 1));
      from.setHours(0, 0, 0, 0);
    }

    onChange({ from, to, label: preset.label });
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (localFrom && localTo) {
      const fromDate = new Date(localFrom);
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = new Date(localTo);
      toDate.setHours(23, 59, 59, 999);

      onChange({ from: fromDate, to: toDate, label: 'Custom' });
      setIsOpen(false);
    }
  };

  const formatDateDisplay = () => {
    if (value.label && value.label !== 'Custom') return value.label;
    if (!value.from) return 'All Time';
    
    return `${value.from.toLocaleDateString()} - ${value.to?.toLocaleDateString() || 'Now'}`;
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
      >
        <Calendar size={16} className="text-slate-500" />
        <span className="font-medium">{formatDateDisplay()}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex flex-col md:flex-row w-full md:w-[500px] overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right">
          
          {/* Presets Sidebar */}
          <div className="w-full md:w-40 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-2 flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-1">
             {presets.map((p) => (
               <button
                 key={p.label}
                 onClick={() => handlePresetClick(p)}
                 className={`text-left px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${value.label === p.label ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
               >
                 {p.label}
               </button>
             ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="flex-1 p-5">
             <h4 className="text-sm font-bold text-slate-800 mb-4">Custom Range</h4>
             <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                   <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
                   <input 
                     type="date" 
                     className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-600"
                     value={localFrom}
                     onChange={(e) => setLocalFrom(e.target.value)}
                   />
                </div>
                <div>
                   <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                   <input 
                     type="date" 
                     className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-600"
                     value={localTo}
                     onChange={(e) => setLocalTo(e.target.value)}
                   />
                </div>
             </div>
             
             <div className="flex justify-end pt-2 border-t border-slate-100 mt-4">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="mr-2 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-md"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleApplyCustom}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
                >
                  Apply Range
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
