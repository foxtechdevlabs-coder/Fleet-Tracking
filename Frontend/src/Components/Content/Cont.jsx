import { EmptyState } from "../Feedback/AsyncState";

function Cont() {
  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">FLEET OVERVIEW</div>
          <h1>Operational Fleet Dashboard</h1>
          <p>Fleet activity and availability will appear here when connected.</p>
        </div>
      </div>
      <EmptyState
        title="Fleet data is not connected"
        message="Connect the fleet data API to load current vehicles, telemetry, and operational activity."
      />
    </main>
  );
}

export default Cont;
