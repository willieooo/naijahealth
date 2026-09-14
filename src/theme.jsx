import React from "react";
import { supabase } from "./supabaseClient";

export const T = {
  bg: "#F5F7FA",
  surface: "#FFFFFF",
  border: "#DCE3EC",
  ink: "#16202B",
  inkSoft: "#5A6B7D",
  primary: "#0B5FA5",
  primaryDark: "#0A3D66",
  primarySoft: "#E1EEF8",
  amber: "#C97A1E",
  amberSoft: "#FBF1E2",
  danger: "#B0402E",
  dangerSoft: "#FBECE8",
};

export const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px",
  border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 16,
  fontFamily: "inherit", color: T.ink, background: "#fff", outline: "none",
};

export function Field({ label, children, hint, error }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: T.inkSoft, marginBottom: 5, letterSpacing: 0.2 }}>
        {label}
      </div>
      {children}
      {error ? (
        <div style={{ fontSize: 14, color: T.danger, marginTop: 4 }}>{error}</div>
      ) : hint ? (
        <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 4 }}>{hint}</div>
      ) : null}
    </label>
  );
}

// A quiet, single motif used on the auth screens: a continuity-of-care
// pulse line running into a rounded cross. Drawn once on load.
export function PulseCrossMark({ size = 132 }) {
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 120);
    return () => clearTimeout(t);
  }, []);
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 220 136" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 88 H62 L78 40 L102 118 L124 24 L142 88 H180"
        stroke="#7FB8E0"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{
          strokeDasharray: 420,
          strokeDashoffset: drawn ? 0 : 420,
          transition: "stroke-dashoffset 1.1s ease-out",
        }}
      />
      <g style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.5s ease-out 0.6s" }}>
        <rect x="176" y="64" width="40" height="40" rx="9" fill="#0B5FA5" />
        <rect x="192" y="72" width="8" height="24" rx="3" fill="#EAF3FB" />
        <rect x="184" y="80" width="24" height="8" rx="3" fill="#EAF3FB" />
      </g>
    </svg>
  );
}

export function AuthHeroPanel({ headline, subtext, states, leadIn }) {
  const [programmes, setProgrammes] = React.useState([]);

  React.useEffect(() => {
    supabase
      .from("health_programmes")
      .select("*, state_instances:state_instance_id(state_name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (!error) setProgrammes(data || []);
      });
  }, []);

  return (
    <div
      className="auth-hero"
      style={{
        flex: "1 1 52%", minWidth: 0, background: "linear-gradient(160deg, #0A3D66 0%, #0B5FA5 62%, #146A9E 100%)",
        color: "#EAF3FB", padding: "64px 56px", display: "flex", flexDirection: "column",
        justifyContent: "space-between", position: "relative", overflow: "hidden",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 46 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.14)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 14, height: 4, background: "#EAF3FB", borderRadius: 2, position: "relative" }}>
              <div style={{ width: 4, height: 14, background: "#EAF3FB", borderRadius: 2, position: "absolute", left: 5, top: -5 }} />
            </div>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.2 }}>NaijaHealth Record</span>
        </div>

        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400, fontSize: 40,
          lineHeight: 1.18, maxWidth: 480, margin: "0 0 20px 0", color: "#FFFFFF",
        }}>
          {headline}
        </h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.6, maxWidth: 440, color: "#C7DDEF", margin: 0 }}>
          {subtext}
        </p>
      </div>

      <div>
        <PulseCrossMark />
        {programmes.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ marginTop: 22, marginBottom: 10, fontSize: 14, color: "#9FC3DE" }}>
              Reminders
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 460 }}>
              {programmes.map((p) => (
                <div key={p.id} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "#FFFFFF" }}>{p.title}</span>
                    {p.state_instances?.state_name && (
                      <span style={{ fontSize: 12.5, color: "#9FC3DE", whiteSpace: "nowrap" }}>{p.state_instances.state_name}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, color: "#C7DDEF", marginTop: 3, lineHeight: 1.5 }}>{p.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {states && states.length > 0 && (
          <>
            <div style={{ marginTop: programmes.length > 0 ? 0 : 22, marginBottom: 10, fontSize: 14, color: "#9FC3DE" }}>
              {leadIn}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, maxWidth: 460 }}>
              {states.slice(0, programmes.length > 0 ? 3 : 5).map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, borderBottom: "1px solid rgba(255,255,255,0.12)", paddingBottom: 7 }}>
                  <span style={{ color: "#EAF3FB" }}>{s.state_name}</span>
                  <span style={{ color: "#9FC3DE" }}>{s.insurance_scheme_name || "—"}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 860px) {
          .auth-hero { display: none; }
        }
      `}</style>
    </div>
  );
}

export function Badge({ children, tone = "primary" }) {
  const tones = {
    primary: { bg: T.primarySoft, fg: T.primaryDark },
    amber: { bg: T.amberSoft, fg: T.amber },
    danger: { bg: T.dangerSoft, fg: T.danger },
  };
  const c = tones[tone];
  return (
    <span style={{
      background: c.bg, color: c.fg, fontSize: 14, fontWeight: 600,
      padding: "3px 9px", borderRadius: 999, letterSpacing: 0.2,
    }}>{children}</span>
  );
}
