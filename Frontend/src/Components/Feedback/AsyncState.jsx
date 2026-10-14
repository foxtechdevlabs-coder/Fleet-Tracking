import { AlertCircle, Inbox } from "lucide-react";
import "./AsyncState.css";

export function LoadingState({ message = "Loading...", compact = false }) {
  return (
    <div
      className={`async-state${compact ? " async-state-compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="async-state-spinner" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({ message, className = "" }) {
  return (
    <div className={`async-state async-state-error ${className}`} role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  title = "No data available",
  message = "Data will appear here when the service is connected."
}) {
  return (
    <div className="async-state async-state-empty" role="status">
      <Inbox size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}
