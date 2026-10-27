import { AlertCircle, Inbox, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import "./AsyncState.css";

interface LoadingStateProps {
  message?: string;
  compact?: boolean;
}

export function LoadingState({ message = "Loading...", compact = false }: LoadingStateProps) {
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

interface ErrorStateProps {
  message: string;
  className?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ message, className = "", onRetry, retryLabel = "Retry" }: ErrorStateProps) {
  return (
    <div className={`async-state async-state-error ${className}`} role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span className="async-state-message">{message}</span>
      {onRetry && (
        <button type="button" className="async-state-action" onClick={onRetry}>
          <RefreshCw size={13} aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: () => void;
  actionLabel?: string;
}

export function EmptyState({
  title = "No data available",
  message = "Data will appear here when the service is connected.",
  action,
  actionLabel = "Retry"
}: EmptyStateProps) {
  return (
    <div className="async-state async-state-empty" role="status">
      <Inbox size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{message}</span>
      {action && (
        <button type="button" className="async-state-action" onClick={action}>
          <RefreshCw size={13} aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface UnauthorizedStateProps {
  message?: string;
  action?: () => void;
  actionLabel?: string;
}

export function UnauthorizedState({
  message = "Your session is no longer authorized. Please sign in again.",
  action,
  actionLabel = "Sign in"
}: UnauthorizedStateProps) {
  return (
    <div className="async-state async-state-unauthorized" role="alert">
      <ShieldAlert size={22} aria-hidden="true" />
      <strong>Access denied</strong>
      <span>{message}</span>
      {action && (
        <button type="button" className="async-state-action" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface ApiUnavailableStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ApiUnavailableState({
  title = "Service unavailable",
  message = "This service is currently unavailable. Please try again later.",
  onRetry,
  retryLabel = "Retry"
}: ApiUnavailableStateProps) {
  return (
    <div className="async-state async-state-unavailable" role="alert">
      <WifiOff size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="async-state-action" onClick={onRetry}>
          <RefreshCw size={13} aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
