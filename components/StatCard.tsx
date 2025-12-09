import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon, color = "blue" }) => {
  const isPositive = change && change >= 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        {change !== undefined && (
          <div className={`flex items-center mt-2 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
            <span>{Math.abs(change)}%</span>
            <span className="text-slate-400 font-normal ml-1">vs last week</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}>
        <Icon size={24} />
      </div>
    </div>
  );
};

export default StatCard;