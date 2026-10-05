import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FleetProvider } from '../context/FleetContext';
import { Shell } from '../components/layout/Shell';
import { DashboardPage } from '../pages/DashboardPage';
import { TrackingPage } from '../pages/TrackingPage';
import { FleetPage, HistoryPage, ReportsPage, SettingsPage } from '../pages/SecondaryPages';
import '../styles/index.css';

export default function App() {
  return (
    <FleetProvider>
      <BrowserRouter>
        <Shell>
          <Routes>
            {/* Dashboard / Live Tracking entry */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/live-tracking" element={<DashboardPage />} />
            
            {/* Dedicated Vehicle Live Tracking View */}
            <Route path="/tracking/:vehicleId" element={<TrackingPage />} />
            <Route path="/live-tracking/:vehicleId" element={<TrackingPage />} />

            {/* Operational Management Pages */}
            <Route path="/fleet" element={<FleetPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </FleetProvider>
  );
}
