import { EmptyState } from "../../Components/Feedback/AsyncState";

function SettingsPage() {
  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">APPLICATION PREFERENCES</div>
          <h1>Settings</h1>
          <p>Application and fleet configuration.</p>
        </div>
      </div>
      <EmptyState
        title="Settings are not connected"
        message="Settings will be available when the configuration API is connected."
      />
    </main>
  );
}

export default SettingsPage;
