import { useState } from "react";
import { Outlet } from "react-router-dom";
import Nav from "../Navbar/Nav";
import Side from "../Sidebar/Side";
import "./AppLayout.css";

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Nav onToggleSidebar={() => setIsSidebarOpen((open) => !open)} />
      <Side isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="app-layout-main">
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
