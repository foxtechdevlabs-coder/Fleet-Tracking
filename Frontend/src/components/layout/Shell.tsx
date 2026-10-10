import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const location = useLocation();
  const isLiveTrackingRoute = location.pathname.includes('tracking') || location.pathname.includes('live-tracking');

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        {!isLiveTrackingRoute && <TopNav />}
        <main className="page-container" data-live-tracking={isLiveTrackingRoute ? 'true' : 'false'}>
          {children}
        </main>
      </div>
    </div>
  );
};
