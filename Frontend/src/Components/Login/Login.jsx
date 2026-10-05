import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Radio,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Activity
} from "lucide-react";
import "./Login.css";
import logo from "../Navbar/logo.svg";

/**
 * Enterprise Telematics Login Component
 * Strictly prepared for backend integration (e.g. POST /api/auth/login)
 * with robust client validation, accessible markup, and real-time state.
 */
function Login({ onAuthSuccess }) {
  const navigate = useNavigate();

  // Controlled Form State
  const [formData, setFormData] = useState({
    emailOrUsername: "",
    password: "",
    rememberMe: false
  });

  // Validation & Submission States
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState("");
  const [focusedField, setFocusedField] = useState(null);

  // Field change handler with real-time error cleanup
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));

    // Clear field-level error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    if (apiError) {
      setApiError("");
    }
  };

  // Client-side validation rule engine
  const validateForm = () => {
    const newErrors = {};

    // Validate Email or Operator ID
    const identity = formData.emailOrUsername.trim();
    if (!identity) {
      newErrors.emailOrUsername = "Operator email or terminal ID is required";
    } else if (identity.includes("@")) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identity)) {
        newErrors.emailOrUsername = "Please enter a valid corporate email address";
      }
    } else if (identity.length < 3) {
      newErrors.emailOrUsername = "Operator ID must be at least 3 characters";
    }

    // Validate Password
    if (!formData.password) {
      newErrors.password = "Authentication password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    return newErrors;
  };

  // Form submission handler ready for backend integration
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      /*
       * BACKEND INTEGRATION HANDLER:
       * When backend endpoint is active, dispatch your real request:
       * 
       * const response = await fetch('/api/auth/login', {
       *   method: 'POST',
       *   headers: { 'Content-Type': 'application/json' },
       *   body: JSON.stringify({
       *     username: formData.emailOrUsername,
       *     password: formData.password,
       *     rememberMe: formData.rememberMe
       *   })
       * });
       * if (!response.ok) throw new Error("Invalid credentials");
       * const data = await response.json();
       */

      if (typeof onAuthSuccess === "function") {
        await onAuthSuccess(formData);
      } else {
        // UI transition to dashboard upon successful validation
        await new Promise((resolve) => setTimeout(resolve, 600));
        navigate("/dashboard");
      }
    } catch (err) {
      setApiError(
        err.message || "Failed to authenticate terminal. Please check your credentials."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fast-fill helper for development / review
  const handleAutoFillDemo = () => {
    setFormData({
      emailOrUsername: "alex.morgan@fleettrack.io",
      password: "Enterprise2026!",
      rememberMe: true
    });
    setErrors({});
    setApiError("");
  };

  return (
    <div className="login-viewport">
      <div className="login-card-container">
        {/* Left Side: Telematics Command Showcase */}
        <div className="login-showcase-panel">
          <div className="showcase-grid-bg"></div>

          {/* Top Logo & Status */}
          <div className="showcase-top">
            <div className="showcase-brand">
              <img src={logo} alt="FleetTrack" className="showcase-logo" />
              <div>
                <span className="brand-name">FleetTrack</span>
                <span className="brand-badge">PHASE 1 TELEMATICS</span>
              </div>
            </div>

            <div className="live-telemetry-beacon">
              <span className="beacon-pulse"></span>
              <span>GATEWAY ONLINE</span>
            </div>
          </div>

          {/* Central Telematics Visual */}
          <div className="showcase-center">
            <div className="showcase-badge-pill">
              <Activity size={13} className="pill-icon" />
              <span>Real-Time Fleet Intelligence</span>
            </div>

            <h1 className="showcase-headline">
              Enterprise Logistics & Vehicle Telematics
            </h1>

            <p className="showcase-subtext">
              High-frequency GPS sensor normalization, geofence perimeters, and sub-second
              telemetry ingestion across operational fleet corridors.
            </p>

            {/* Live Telemetry Radar Preview Card */}
            <div className="telemetry-live-card">
              <div className="card-top-row">
                <div className="unit-identifier">
                  <Radio size={14} className="radio-icon" />
                  <strong>VH-001 • TN 74 AB 1234</strong>
                </div>
                <span className="speed-tag">54 km/h • NE</span>
              </div>

              <div className="telemetry-radar-strip">
                <div className="strip-item">
                  <span className="strip-label">Status</span>
                  <span className="strip-val active-green">● Moving</span>
                </div>
                <div className="strip-item">
                  <span className="strip-label">GPS Lock</span>
                  <span className="strip-val">99.8%</span>
                </div>
                <div className="strip-item">
                  <span className="strip-label">Nodes</span>
                  <span className="strip-val">248 / 250</span>
                </div>
                <div className="strip-item">
                  <span className="strip-label">Latency</span>
                  <span className="strip-val">42 ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Security Assurance */}
          <div className="showcase-bottom">
            <div className="security-tag">
              <ShieldCheck size={14} className="shield-icon" />
              <span>AES-256 Bit Encrypted Telemetry Gateway</span>
            </div>
            <span className="version-tag">Terminal Build v1.4.2</span>
          </div>
        </div>

        {/* Right Side: Credential Authentication Form */}
        <div className="login-form-panel">
          <div className="form-inner-wrapper">
            {/* Header */}
            <div className="form-header">
              <div className="portal-badge">
                <Cpu size={12} />
                <span>OPERATIONAL CONSOLE ACCESS</span>
              </div>
              <h2 className="form-title">Operator Sign In</h2>
              <p className="form-subtitle">
                Enter your authorized credentials to access telemetry nodes & fleet command.
              </p>
            </div>

            {/* API Error Notification */}
            {apiError && (
              <div className="api-error-alert" role="alert">
                <AlertCircle size={15} />
                <span>{apiError}</span>
              </div>
            )}

            {/* Interactive Form */}
            <form onSubmit={handleSubmit} noValidate className="auth-form">
              {/* Email / Username Field */}
              <div className={`form-group ${errors.emailOrUsername ? "has-error" : ""}`}>
                <label htmlFor="emailOrUsername">
                  Operator Email or Terminal ID
                </label>
                <div
                  className={`input-container ${
                    focusedField === "emailOrUsername" ? "is-focused" : ""
                  }`}
                >
                  <Mail size={16} className="input-icon" />
                  <input
                    id="emailOrUsername"
                    name="emailOrUsername"
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. operator@fleettrack.io or VH-ADMIN"
                    value={formData.emailOrUsername}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("emailOrUsername")}
                    onBlur={() => setFocusedField(null)}
                    disabled={isSubmitting}
                    aria-invalid={!!errors.emailOrUsername}
                    aria-describedby={
                      errors.emailOrUsername ? "email-error" : undefined
                    }
                  />
                </div>
                {errors.emailOrUsername && (
                  <span id="email-error" className="field-error-msg" role="alert">
                    <AlertCircle size={12} />
                    {errors.emailOrUsername}
                  </span>
                )}
              </div>

              {/* Password Field */}
              <div className={`form-group ${errors.password ? "has-error" : ""}`}>
                <div className="label-row">
                  <label htmlFor="password">Authentication Password</label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Please contact your Fleet Systems Administrator to reset access tokens.");
                    }}
                    className="forgot-link"
                  >
                    Forgot access key?
                  </a>
                </div>
                <div
                  className={`input-container ${
                    focusedField === "password" ? "is-focused" : ""
                  }`}
                >
                  <Lock size={16} className="input-icon" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    disabled={isSubmitting}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <span id="password-error" className="field-error-msg" role="alert">
                    <AlertCircle size={12} />
                    {errors.password}
                  </span>
                )}
              </div>

              {/* Remember Me & Terminal Session */}
              <div className="form-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  <span>Trust & remember this terminal (30 days)</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="submit-spinner"></span>
                    <span>Authenticating Terminal...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate & Enter Console</span>
                    <ArrowRight size={16} className="arrow-icon" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials Autofill Banner */}
            <div className="demo-helper-box">
              <div className="demo-text">
                <CheckCircle2 size={14} className="demo-check" />
                <span>Need quick access for console inspection?</span>
              </div>
              <button
                type="button"
                className="autofill-btn"
                onClick={handleAutoFillDemo}
                title="Fill operator credentials"
              >
                Fill Operator Demo
              </button>
            </div>

            {/* Compliance Footer */}
            <div className="form-footer-compliance">
              <p>
                Strictly for authorized fleet personnel. Real-time telemetry ingestion
                audit logs are active. Unauthorized access is subject to monitoring.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
