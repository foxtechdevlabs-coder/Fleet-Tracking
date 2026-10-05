import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

function NotFoundPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#f8fafc",
      color: "#0f172a",
      textAlign: "center",
      padding: "20px"
    }}>
      <div style={{
        background: "#eff6ff",
        color: "#2563eb",
        width: "64px",
        height: "64px",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "16px"
      }}>
        <Compass size={32} />
      </div>
      <h1 style={{ fontSize: "36px", margin: "0 0 8px", color: "#1e3e62", fontWeight: "800" }}>404</h1>
      <h2 style={{ fontSize: "18px", margin: "0 0 12px", color: "#334155" }}>Waypoint Not Found</h2>
      <p style={{ maxWidth: "420px", color: "#64748b", fontSize: "13px", lineHeight: "1.5", marginBottom: "24px" }}>
        The telematics console route you are attempting to reach does not correspond to an active operational module.
      </p>
      <Link to="/dashboard" style={{
        background: "#102d52",
        color: "white",
        padding: "10px 18px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "600",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        textDecoration: "none"
      }}>
        <ArrowLeft size={14} /> Return to Fleet Dashboard
      </Link>
    </div>
  );
}

export default NotFoundPage;
