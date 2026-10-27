import { ApiUnavailableState } from "../../Components/Feedback/AsyncState";
import "./FleetPage.css";

function FleetPage() {
  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">ASSET & INVENTORY REGISTRY</div>
          <h1>Fleet Asset Management</h1>
          <p>Registered vehicles and assigned devices.</p>
        </div>
      </div>
      <ApiUnavailableState
        title="Fleet data unavailable"
        message="Fleet records will appear here when the vehicle and device APIs are connected."
      />
    </main>
  );
}

export default FleetPage;
