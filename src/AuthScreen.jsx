import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { T, inputStyle, Field, AuthHeroPanel } from "./theme.jsx";

const ROLES = [
  { value: "front_desk", label: "Front desk" },
  { value: "clinician", label: "Clinician" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "records_officer", label: "Records officer" },
  { value: "admin", label: "Admin" },
];

export default function AuthScreen({ signIn, signUp }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [states, setStates] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("front_desk");
  const [stateInstanceId, setStateInstanceId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("state_instances")
      .select("id, state_name, insurance_scheme_name")
      .order("state_name")
      .then(({ data, error }) => {
        if (!error && data) {
          setStates(data);
          if (data.length) setStateInstanceId(data[0].id);
        }
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    if (mode === "signin") {
      const { error } = await signIn({ email, password });
      if (error) setError(error.message);
    } else {
      if (!fullName.trim() || !stateInstanceId) {
        setError("Full name and state are required.");
        setBusy(false);
        return;
      }
      const { error, needsConfirmation } = await signUp({ email, password, fullName, role, stateInstanceId });
      if (error) {
        setError(error.message);
      } else if (needsConfirmation) {
        setNotice("Check your email to confirm your account, then come back and sign in. You'll be asked to finish setting up your profile the first time you sign in.");
        setMode("signin");
      } else {
        setNotice("Account created.");
      }
    }
    setBusy(false);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Hero / institutional panel — hidden on narrow viewports so the
          form stays the priority on phones and small tablets. */}
      <AuthHeroPanel
        headline="One health record, wherever a resident is treated in the state."
        subtext="Front desk, clinical, and pharmacy staff at every participating facility work from the same patient record — registered once, accessible anywhere in the state."
        states={states}
        leadIn="Built to work alongside existing state health insurance schemes, including"
      />

      {/* Sign-in / sign-up form */}
      <div style={{
        flex: "1 1 48%", minWidth: 0, background: T.bg, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 28,
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: T.primaryDark }}>
            {mode === "signin" ? "Sign in" : "Create a staff account"}
          </div>
          <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 22 }}>
            {mode === "signin" ? "Enter your facility credentials to continue." : "You'll pick your state and role below."}
          </div>

          <form onSubmit={handleSubmit} autoComplete="off">
            {mode === "signup" && (
              <Field label="Full name">
                <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Dr. F. Adisa" autoComplete="off" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@facility.gov.ng" autoComplete="off" name="staff-email" />
            </Field>
            <Field label="Password">
              <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" name="staff-password" />
            </Field>

            {mode === "signup" && (
              <>
                <Field label="Role">
                  <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </Field>
                <Field label="State instance" hint="Determines which state's patient records you can access.">
                  <select style={inputStyle} value={stateInstanceId} onChange={(e) => setStateInstanceId(e.target.value)}>
                    {states.map((s) => <option key={s.id} value={s.id}>{s.state_name}</option>)}
                  </select>
                </Field>
              </>
            )}

            {error && (
              <div style={{ background: T.dangerSoft, color: T.danger, padding: "9px 12px", borderRadius: 8, fontSize: 15, marginBottom: 14 }}>
                {error}
              </div>
            )}
            {notice && (
              <div style={{ background: T.primarySoft, color: T.primaryDark, padding: "9px 12px", borderRadius: 8, fontSize: 15, marginBottom: 14 }}>
                {notice}
              </div>
            )}

            <button type="submit" disabled={busy} style={{
              width: "100%", background: T.primary, color: "#fff", border: "none", padding: "11px 18px",
              borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
            }}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div style={{ marginTop: 16, fontSize: 14.5, color: T.inkSoft, textAlign: "center" }}>
            {mode === "signin" ? (
              <>No account? <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); setError(""); setNotice(""); }} style={{ color: T.primary, fontWeight: 600 }}>Create one</a></>
            ) : (
              <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode("signin"); setError(""); setNotice(""); }} style={{ color: T.primary, fontWeight: 600 }}>Sign in</a></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
