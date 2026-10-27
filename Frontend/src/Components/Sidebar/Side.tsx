import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Truck,
  Cpu,
  Navigation,
  History,
  FileSpreadsheet,
  Settings
} from "lucide-react";
import "./Side.css";
import { useAuth } from "../../auth/AuthContext";

interface SideProps {
  isOpen: boolean;
  onClose: () => void;
}

function Side({ isOpen, onClose }: SideProps) {
  const { admin } = useAuth();
  if (!admin) return null;

  const menuItems = [
    {
      icon: <LayoutDashboard size={16} />,
      name: "Dashboard",
      path: "/dashboard"
    },
    {
      icon: <Truck size={16} />,
      name: "Fleet",
      path: "/fleet"
    },
    {
      icon: <Cpu size={16} />,
      name: "Device + Vehicle",
      path: "/device-vehicle"
    },
    {
      icon: <Navigation size={16} />,
      name: "Live Tracking",
      path: "/live-tracking"
    },
    {
      icon: <History size={16} />,
      name: "History",
      path: "/history"
    },
    {
      icon: <FileSpreadsheet size={16} />,
      name: "Reports",
      path: "/reports"
    },
    {
      icon: <Settings size={16} />,
      name: "Settings",
      path: "/settings"
    }
  ];

  return (
    <aside className={`sidebar${isOpen ? " sidebar-open" : ""}`}>
      {/* Menu Title */}
      <div className="side-title">OPERATIONAL FLEET MENU</div>

      {/* Navigation */}
      <nav className="side-menu">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.name}
            aria-label={item.name}
            className={({ isActive }) =>
              `side-item ${isActive ? "side-item-active" : ""}`
            }
            onClick={onClose}
          >
            <span className="side-icon">{item.icon}</span>
            <span className="side-label">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom Status */}
      <div className="nodes-status">
        <div className="node-left">
          <span className="node-dot node-dot-preview"></span>
          <span>Signed in as {admin.name}</span>
        </div>
        <strong>Secure</strong>
      </div>
    </aside>
  );
}

export default Side;