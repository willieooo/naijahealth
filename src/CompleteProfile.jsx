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

export default function CompleteProfile({ completeProfile, signOut }) {
  const [states, setStates] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("front_desk");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [stateInstanceId, setStateInstanceId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requiresLicense = role === "clinician" || role === "pharmacist";

  useEffect(() => {
    supabase.from("state_instances").select("id, state_name, insurance_scheme_name").order("state_name").then(({ data, error }) => {
      if (!error && data) {
        setStates(data);
        if (data.length) setStateInstanceId(data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!stateInstanceId) return;
    supabase.from("facilities").select("id, name").eq("state_instance_id", stateInstanceId).order("name").then(({ data, error }) => {
      if (!error && data) {
        setFacilities(data);
        setFacilityId(data.length ? data[0].id : "");
      }
    });
  }, [stateInstanceId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fullName.trim() || !stateInstanceId) {
      setError("Full name and state are required.");
      return;
    }
    if (requiresLicense && !licenseNumber.trim()) {
      setError("A license/registration number is required for clinicians and pharmacists.");
      return;
    }
    setBusy(true);
    setError("");
    const { error } = await completeProfile({ fullName, role, stateInstanceId, licenseNumber: licenseNumber.trim() || null, facilityId: facilityId || null });
    if (error) {
      setError(error.message.toLowerCase().includes("duplicate") || error.message.toLowerCase().includes("unique")
        ? "That license/registration number is already linked to another account."
        : error.message);
    }
    setBusy(false);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <AuthHeroPanel
        headline="Almost there — set up your staff profile."
        subtext="Your email is confirmed. A few details about your role and facility, and you're in."
        states={states}
        leadIn="This account will operate within one of the following state programmes"
      />

      <div style={{
        flex: "1 1 48%", minWidth: 0, background: T.bg, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 28,
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: T.primaryDark }}>Finish setting up your account</div>
          <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 22 }}>
            Just a few more details to create your staff profile.
          </div>
          <form onSubmit={handleSubmit}>
            <Field label="Full name">
              <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Dr. F. Adisa" />
            </Field>
            <Field label="Role">
              <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            {requiresLicense && (
              <Field label="License / registration number" hint="e.g. your MDCN or pharmacy council registration number. Unique per account.">
                <input style={inputStyle} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="e.g. MDCN/12345" />
              </Field>
            )}
            <Field label="State instance" hint="Determines which state's patient records you can access.">
              <select style={inputStyle} value={stateInstanceId} onChange={(e) => setStateInstanceId(e.target.value)}>
                {states.map((s) => <option key={s.id} value={s.id}>{s.state_name}</option>)}
              </select>
            </Field>
            <Field label="Facility" hint="The facility you work at — determines which patients you can open without extra justification.">
              <select style={inputStyle} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                {facilities.length === 0 && <option value="">No facilities found for this state</option>}
                {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
            {error && (
              <div style={{ background: T.dangerSoft, color: T.danger, padding: "9px 12px", borderRadius: 8, fontSize: 15, marginBottom: 14 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={busy} style={{
              width: "100%", background: T.primary, color: "#fff", border: "none", padding: "11px 18px",
              borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
            }}>
              {busy ? "Saving…" : "Finish setup"}
            </button>
          </form>
          <div style={{ marginTop: 16, fontSize: 14.5, color: T.inkSoft, textAlign: "center" }}>
            Wrong account? <a href="#" onClick={(e) => { e.preventDefault(); signOut(); }} style={{ color: T.primary, fontWeight: 600 }}>Sign out</a>
          </div>
        </div>
      </div>
    </div>
  );
}
