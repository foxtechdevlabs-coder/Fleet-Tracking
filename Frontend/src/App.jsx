import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./Components/Layout/AppLayout";
import Cont from "./Components/Content/Cont";
import Login from "./Components/Login/Login";
import FleetPage from "./Pages/Fleet/FleetPage";
import DeviceVehiclePage from "./Pages/DeviceVehicle/DeviceVehiclePage";
import LiveTrackingPage from "./Pages/LiveTracking/LiveTrackingPage";
import HistoryPage from "./Pages/History/HistoryPage";
import ReportsPage from "./Pages/Reports/ReportsPage";
import SettingsPage from "./Pages/Settings/SettingsPage";
import NotFoundPage from "./Pages/NotFound/NotFoundPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication Route */}
        <Route path="/login" element={<Login />} />

        {/* Application layout routes */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Cont />} />
          <Route path="device-vehicle" element={<DeviceVehiclePage />} />
          <Route path="fleet" element={<FleetPage />} />
          <Route path="live-tracking" element={<LiveTrackingPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;