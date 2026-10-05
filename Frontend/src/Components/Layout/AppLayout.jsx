import React from "react";
import { Outlet } from "react-router-dom";
import Nav from "../Navbar/Nav";
import Side from "../Sidebar/Side";
import "./AppLayout.css";

function AppLayout() {
  return (
    <div className="app-layout">
      <Nav />
      <Side />
      <div className="app-layout-main">
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
