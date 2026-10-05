import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  Cpu,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck
} from "lucide-react";
import "./Login.css";
import logo from "../Navbar/logo.svg";

function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setApiError("");

    const nextErrors = {};
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      if (typeof onLogin !== "function") {
        await Promise.resolve();
        throw new Error("Sign-in is unavailable until the authentication API is connected.");
      }

      await onLogin({ email: normalizedEmail, password });
      navigate("/dashboard");
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to sign in. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
    setErrors((current) => {
      const next = { ...current };
      delete next.email;
      return next;
    });
    setApiError("");
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    setErrors((current) => {
      const next = { ...current };
      delete next.password;
      return next;
    });
    setApiError("");
  };

  return (
    <main className="login-viewport">
      <div className="login-card-container">
        <section className="login-showcase-panel" aria-label="FleetTrack overview">
          <div className="showcase-grid-bg" />

          <div className="showcase-top">
            <div className="showcase-brand">
              <img src={logo} alt="" className="showcase-logo" />
              <div>
                <span className="brand-name">FleetTrack</span>
                <span className="brand-badge">FLEET OPERATIONS</span>
              </div>
            </div>
          </div>

          <div className="showcase-center">
            <div className="showcase-badge-pill">
              <Activity size={13} className="pill-icon" />
              <span>Fleet operations, in one place</span>
            </div>
            <h1 className="showcase-headline">
              Stay connected to your entire fleet.
            </h1>
            <p className="showcase-subtext">
              Sign in to manage vehicles, monitor live tracking, and access
              operational reports from one workspace.
            </p>

            <ul className="showcase-features">
              <li><Check size={15} /> Vehicle and device management</li>
              <li><Check size={15} /> Live fleet tracking</li>
              <li><Check size={15} /> Operational reporting</li>
            </ul>
          </div>

          <div className="showcase-bottom">
            <div className="security-tag">
              <ShieldCheck size={14} className="shield-icon" />
              <span>Secure access for fleet operators</span>
            </div>
          </div>
        </section>

        <section className="login-form-panel" aria-labelledby="login-title">
          <div className="form-inner-wrapper">
            <div className="form-header">
              <div className="portal-badge">
                <Cpu size={12} />
                <span>FLEET OPERATIONS PORTAL</span>
              </div>
              <h2 id="login-title" className="form-title">Welcome back</h2>
              <p className="form-subtitle">
                Enter your email and password to continue.
              </p>
            </div>

            {apiError && (
              <div className="api-error-alert" role="alert">
                <AlertCircle size={15} />
                <span>{apiError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="auth-form">
              <div className={`form-group ${errors.email ? "has-error" : ""}`}>
                <label htmlFor="email">Email</label>
                <div className="input-container">
                  <Mail size={16} className="input-icon" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={email}
                    onChange={handleEmailChange}
                    disabled={isSubmitting}
                    required
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                </div>
                {errors.email && (
                  <span id="email-error" className="field-error-msg" role="alert">
                    <AlertCircle size={12} />
                    {errors.email}
                  </span>
                )}
              </div>

              <div className={`form-group ${errors.password ? "has-error" : ""}`}>
                <label htmlFor="password">Password</label>
                <div className="input-container">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={handlePasswordChange}
                    disabled={isSubmitting}
                    required
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowPassword((visible) => !visible)}
                    disabled={isSubmitting}
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

              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="submit-spinner" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight size={16} className="arrow-icon" />
                  </>
                )}
              </button>
            </form>

            <div className="form-footer-compliance">
              <p>Your credentials are only submitted when an authentication service is connected.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Login;
