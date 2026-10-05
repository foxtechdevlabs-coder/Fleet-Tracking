import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Radio, Clock, LogOut, ChevronRight } from "lucide-react";
import "./Nav.css";
import logo from "./logo.svg";

const routeTitles = {
  "/dashboard": "Fleet Telematics",
  "/device-vehicle": "Device + Vehicle Provisioning",
  "/fleet": "Fleet Directory",
  "/live-tracking": "Live GPS Tracking",
  "/history": "Telemetry History",
  "/reports": "Operational Reports",
  "/settings": "System Settings"
};

function Nav() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Kolkata"
      });
      setCurrentTime(timeStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentSection = routeTitles[location.pathname] || "Fleet Telematics";

  const handleExit = () => {
    // Navigate to Login page
    navigate("/login");
  };

  return (
    <header className="top-nav">
      {/* Logo */}
      <Link to="/dashboard" className="nav-logo" title="FleetTrack Home">
        <img className="logo-icon" src={logo} alt="FleetTrack Logo" />
        <span className="logo-text">FleetTrack</span>
        <small className="phase-badge">PHASE 1</small>
      </Link>

      {/* Dynamic Breadcrumb */}
      <div className="nav-breadcrumb">
        <span>Console</span>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <strong>{currentSection}</strong>
      </div>

      {/* Right Section */}
      <div className="nav-right">
        {/* Realtime Status */}
        <div className="connection-status" title="Telemetry WebSocket Gateway Connected">
          <span className="status-dot"></span>
          <Radio size={12} className="status-icon" />
          <span>Realtime Connected</span>
        </div>

        {/* Live IST Time */}
        <div className="nav-time" title="Indian Standard Time">
          <div className="time-display">
            <Clock size={11} className="time-icon" />
            <span>{currentTime || "15:42:08"} IST</span>
          </div>
          <small>Asia/Kolkata</small>
        </div>

        {/* User Profile */}
        <div className="user-profile" title="Signed in as Alex Morgan">
          <div className="avatar">AM</div>
          <div className="user-info">
            <strong>Alex Morgan</strong>
            <small>Fleet Admin</small>
          </div>
        </div>

        {/* Exit / Logout Action */}
        <button
          className="exit-btn"
          onClick={handleExit}
          title="Sign out to Login"
          aria-label="Exit console to Login"
        >
          <LogOut size={13} className="exit-icon" />
          <span>Exit</span>
        </button>
      </div>
    </header>
  );
}

export default Nav;