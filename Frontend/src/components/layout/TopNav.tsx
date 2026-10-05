import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, Clock, ChevronRight } from 'lucide-react';

export const TopNav: React.FC = () => {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format as e.g. "15:42:08 IST (Asia/Kolkata)"
      const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const timeStr = formatter.format(now);
      setCurrentTime(`${timeStr} IST (Asia/Kolkata)`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getSubBreadcrumb = () => {
    if (location.pathname.startsWith('/tracking') || location.pathname.startsWith('/live-tracking')) {
      return 'Live Telemetry Vehicle Focus';
    }
    if (location.pathname === '/fleet') return 'Fleet Registry';
    if (location.pathname === '/history') return 'Historical Playback';
    if (location.pathname === '/reports') return 'Analytics & Reports';
    if (location.pathname === '/settings') return 'System Configuration';
    return 'Fleet Telematics';
  };

  return (
    <header className="top-nav">
      {/* Left side: Breadcrumb & Connection Status */}
      <div className="top-nav-left">
        <nav className="breadcrumb-trail" aria-label="Breadcrumb">
          <span>Console</span>
          <ChevronRight className="separator" size={14} />
          <span className="active-crumb">{getSubBreadcrumb()}</span>
        </nav>

        <div className="connection-pill" title="Telemetry MQTT WebSocket active">
          <span className="pulse-dot" />
          <span>Realtime Connected</span>
        </div>
      </div>

      {/* Right side: Clock, Profile, Exit */}
      <div className="top-nav-right">
        <div className="ist-clock" title="Primary ingestion cluster time">
          <Clock size={14} color="#0284c7" />
          <span>{currentTime || '15:42:08 IST (Asia/Kolkata)'}</span>
        </div>

        <div className="user-profile-widget">
          <div className="user-avatar" title="Alex Morgan">
            AM
          </div>
          <div className="user-details">
            <span className="user-name">Alex Morgan</span>
            <span className="user-role">Fleet Admin</span>
          </div>
        </div>

        <button
          className="exit-btn"
          title="Exit Session"
          onClick={() => {
            if (window.confirm('Log out of FleetOps Logistics Console?')) {
              window.location.href = '/';
            }
          }}
        >
          <LogOut size={14} />
          <span>Exit</span>
        </button>
      </div>
    </header>
  );
};
