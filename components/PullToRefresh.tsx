
import React, { useState, useEffect, useRef } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].pageY;
    } else {
      startY.current = -1;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === -1 || refreshing) return;

    const currentY = e.touches[0].pageY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      setPullProgress(Math.min(diff / 100, 1));
    }
  };

  const handleTouchEnd = async () => {
    if (pullProgress >= 1) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setPullProgress(0);
    startY.current = -1;
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative h-full overflow-y-auto"
    >
      <div 
        className="absolute top-0 left-0 w-full flex justify-center items-center overflow-hidden transition-all duration-200 pointer-events-none"
        style={{ height: refreshing ? '4rem' : `${pullProgress * 4}rem`, opacity: pullProgress > 0.1 || refreshing ? 1 : 0 }}
      >
        <div className={`text-emerald-600 transition-transform duration-300 ${refreshing ? 'animate-spin' : ''}`}>
           <i className={`fas ${refreshing ? 'fa-sync-alt text-xl' : 'fa-arrow-down'}`}></i>
        </div>
        {!refreshing && pullProgress >= 1 && <span className="ml-2 text-sm font-medium text-emerald-600">Release to refresh</span>}
      </div>
      <div style={{ transform: refreshing ? 'translateY(4rem)' : `translateY(${pullProgress * 4}rem)` }} className="transition-transform duration-200">
        {children}
      </div>
    </div>
  );
};
