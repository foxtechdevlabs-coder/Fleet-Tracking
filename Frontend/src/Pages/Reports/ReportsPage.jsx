import { EmptyState } from "../../Components/Feedback/AsyncState";

function ReportsPage() {
  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">FLEET ANALYTICS</div>
          <h1>Operational Reports</h1>
          <p>Fleet usage and operational summaries.</p>
        </div>
      </div>
      <EmptyState
        title="No report data loaded"
        message="Reports will appear here when reporting data is available."
      />
    </main>
  );
}

export default ReportsPage;
