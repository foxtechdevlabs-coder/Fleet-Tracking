import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Radio,
  History,
  FileBarChart,
  Settings,
  ShieldCheck,
  Server
} from 'lucide-react';

export const Sidebar: React.FC = () => {
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
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard className="nav-icon" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/fleet"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Truck className="nav-icon" />
          <span>Fleet</span>
        </NavLink>

        <NavLink
          to="/live-tracking"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Radio className="nav-icon" />
          <span>Live Tracking</span>
          <span className="sidebar-nav-badge">Live</span>
        </NavLink>

        <NavLink
          to="/history"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <History className="nav-icon" />
          <span>History</span>
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <FileBarChart className="nav-icon" />
          <span>Reports</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings className="nav-icon" />
          <span>Settings</span>
        </NavLink>
      </nav>

      {/* Security & System Info */}
      <div style={{ padding: '0 12px 12px' }}>
        <div className="sidebar-security-badge">
          <ShieldCheck size={14} color="#0d9488" />
          <span>Telematics Mesh Encrypted</span>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-status-card">
          <div className="status-node-info">
            <div className="pulse-dot" />
            <span>Nodes Online: <strong>248 / 250</strong></span>
          </div>
          <Server size={14} color="#64748b" />
        </div>
      </div>
    </aside>
  );
};
