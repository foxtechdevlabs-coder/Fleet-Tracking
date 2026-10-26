import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Radio,
  History,
  FileBarChart,
  Settings,
  Server,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';

export const Sidebar: React.FC = () => {
  const { error, isLoading, isRefreshing } = useFleet();
  const apiStatus = isLoading || isRefreshing
    ? 'Checking snapshot APIs'
    : error
      ? 'Snapshot API unavailable'
      : 'Snapshot APIs available';

  return (
    <aside className="app-sidebar" aria-label="Operational Fleet Menu">
      {/* Brand Header */}
      <div className="sidebar-header">
        <NavLink to="/" className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Radio size={20} />
          </div>
          <div>
            <div className="sidebar-brand-text">FleetTrack</div>
          </div>
        </NavLink>
        <span className="phase-badge">Phase 1</span>
      </div>

      {/* Main Nav Section */}
      <div className="sidebar-section-title">Operational Fleet Menu</div>
      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          aria-label="Dashboard"
          title="Dashboard"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard className="nav-icon" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/fleet"
          aria-label="Fleet"
          title="Fleet"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Truck className="nav-icon" />
          <span>Fleet</span>
        </NavLink>

        <NavLink
          to="/live-tracking"
          aria-label="Live Tracking"
          title="Live Tracking"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Radio className="nav-icon" />
          <span>Live Tracking</span>
          <span className="sidebar-nav-badge">Map</span>
        </NavLink>

        <NavLink
          to="/history"
          aria-label="History"
          title="History"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <History className="nav-icon" />
          <span>History</span>
        </NavLink>

        <NavLink
          to="/reports"
          aria-label="Reports"
          title="Reports"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <FileBarChart className="nav-icon" />
          <span>Reports</span>
        </NavLink>

        <NavLink
          to="/settings"
          aria-label="Settings"
          title="Settings"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings className="nav-icon" />
          <span>Settings</span>
        </NavLink>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-status-card">
          <div className="status-node-info">
            <div className="pulse-dot" style={{ background: error ? '#ef4444' : isLoading || isRefreshing ? '#f59e0b' : '#10b981' }} />
            <span>{apiStatus}</span>
          </div>
          <Server size={14} color="#64748b" />
        </div>
      </div>
    </aside>
  );
};
