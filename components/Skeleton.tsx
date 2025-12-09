
import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
  );
};

export const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 h-32">
    <Skeleton className="h-4 w-24 mb-4" />
    <Skeleton className="h-8 w-16 mb-2" />
    <Skeleton className="h-4 w-32" />
  </div>
);

export const ChartSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 h-96">
    <Skeleton className="h-6 w-48 mb-6" />
    <div className="h-full flex items-end space-x-4 pb-6">
       <Skeleton className="h-1/3 w-full" />
       <Skeleton className="h-1/2 w-full" />
       <Skeleton className="h-2/3 w-full" />
       <Skeleton className="h-1/2 w-full" />
       <Skeleton className="h-3/4 w-full" />
    </div>
  </div>
);
