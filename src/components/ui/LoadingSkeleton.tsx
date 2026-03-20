import React from 'react';

export const LoadingSkeleton: React.FC = () => (
  <div className="p-4 lg:p-8 space-y-6 animate-pulse">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-low rounded-xl h-48" />
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2].map((i) => (
        <div key={i} className="bg-surface-low rounded-xl h-64" />
      ))}
    </div>
  </div>
);
