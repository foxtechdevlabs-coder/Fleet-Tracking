import { EmptyState } from "../../Components/Feedback/AsyncState";
import "./LiveTrackingPage.css";

function LiveTrackingPage() {
  return (
    <main className="content">
      <div className="tracking-header">
        <div>
          <div className="section-label">LIVE FLEET MONITORING</div>
          <h1>Live Tracking</h1>
          <p>Current vehicle locations and telemetry.</p>
        </div>
      </div>
      <EmptyState
        title="Live tracking is not connected"
        message="Vehicle positions and telemetry will appear when the tracking API is available."
      />
    </main>
  );
}

export default LiveTrackingPage;
