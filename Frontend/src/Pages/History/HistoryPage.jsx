import { ApiUnavailableState } from "../../Components/Feedback/AsyncState";

function HistoryPage() {
  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">TELEMETRY AUDIT TRAIL</div>
          <h1>Telemetry & Route History</h1>
          <p>Historical sensor events and trip records.</p>
        </div>
      </div>
      <ApiUnavailableState
        title="History data unavailable"
        message="Telemetry history will appear here when the history API is connected."
      />
    </main>
  );
}

export default HistoryPage;
