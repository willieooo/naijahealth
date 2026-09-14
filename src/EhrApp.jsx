import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { T, inputStyle, Field, Badge } from "./theme.jsx";

function validateNIN(nin) {
  if (!nin) return { valid: true, message: "" };
  if (!/^\d{11}$/.test(nin)) return { valid: false, message: "NIN must be exactly 11 digits." };
  return { valid: true, message: "" };
}

const ROLE_OPTIONS = [
  { value: "front_desk", label: "Front desk" },
  { value: "clinician", label: "Clinician" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "records_officer", label: "Records officer" },
  { value: "admin", label: "Admin" },
];

export default function EhrApp({ profile, signOut, refreshProfile }) {
  const [tab, setTab] = useState("patients");
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [patientSubTab, setPatientSubTab] = useState("summary");
  const [encounters, setEncounters] = useState([]);
  const [medications, setMedications] = useState([]);
  const [careGaps, setCareGaps] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [staffUpdating, setStaffUpdating] = useState({});
  const [breakGlassPrompt, setBreakGlassPrompt] = useState(null); // { patientId, patientName } or null
  const [breakGlassReason, setBreakGlassReason] = useState("");
  const [breakGlassSubmitting, setBreakGlassSubmitting] = useState(false);
  const [emergencyPatientIds, setEmergencyPatientIds] = useState({});
  const [documents, setDocuments] = useState([]);
  const [docDraft, setDocDraft] = useState({ title: "", documentType: "lab_result", file: null });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [investigations, setInvestigations] = useState([]);
  const [smsNotifications, setSmsNotifications] = useState([]);
  const [referralDraft, setReferralDraft] = useState({ toFacilityId: "", specialty: "", reason: "", clinicalDetails: "", urgency: "routine" });
  const [savingReferral, setSavingReferral] = useState(false);
  const [invDraft, setInvDraft] = useState({ testName: "", category: "other", referralId: "" });
  const [savingInv, setSavingInv] = useState(false);
  const [resultDrafts, setResultDrafts] = useState({});
  const [immunizations, setImmunizations] = useState([]);
  const [warningDraft, setWarningDraft] = useState("");
  const [savingWarning, setSavingWarning] = useState(false);
  const [immDraft, setImmDraft] = useState({ vaccineName: "", doseNumber: "", dateGiven: new Date().toISOString().slice(0, 10) });
  const [savingImm, setSavingImm] = useState(false);
  const [allergies, setAllergies] = useState([]);
  const [problems, setProblems] = useState([]);
  const [audit, setAudit] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [toast, setToast] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [allergyDraft, setAllergyDraft] = useState({ substance: "", reaction: "" });
  const [problemDraft, setProblemDraft] = useState({ description: "", significance: "significant", onsetDate: "" });
  const [savingAllergy, setSavingAllergy] = useState(false);
  const [savingProblem, setSavingProblem] = useState(false);
  const [medDraft, setMedDraft] = useState({ drugName: "", dosage: "", rxType: "acute", durationDays: "", quantity: "" });
  const [savingMed, setSavingMed] = useState(false);
  const [encounterDraft, setEncounterDraft] = useState({ encounterType: "Consultation", diagnosis: "", history: "", examination: "", comment: "", facilityId: "" });
  const [savingEncounter, setSavingEncounter] = useState(false);
  const [isolationResult, setIsolationResult] = useState(null);
  const [programmes, setProgrammes] = useState([]);
  const [programmeDraft, setProgrammeDraft] = useState({ title: "", description: "", startDate: "", endDate: "" });
  const [savingProgramme, setSavingProgramme] = useState(false);
  const [isolationRunning, setIsolationRunning] = useState(false);
  const [tamperResult, setTamperResult] = useState(null);
  const [tamperRunning, setTamperRunning] = useState(false);

  const [form, setForm] = useState({
    firstName: "", middleName: "", surname: "", nin: "", dob: "", sex: "Female", phone: "",
    street: "", lga: "", facilityId: "",
  });

  const stateName = profile?.state_instances?.state_name || "—";
  const scheme = profile?.state_instances?.insurance_scheme_name || "—";
  const board = profile?.state_instances?.phc_board_name || "—";

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }, []);

  const loadPatients = useCallback(async () => {
    setPatientsLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("*, allergies(id)")
      .order("created_at", { ascending: false });
    if (error) {
      showToast(`Failed to load patients: ${error.message}`);
    } else {
      setPatients(data || []);
      // No auto-select of the first patient — every selection must go through
      // handleSelectPatient so the break-glass check always runs.
    }
    setPatientsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFacilities = useCallback(async () => {
    const { data, error } = await supabase.from("facilities").select("id, name, facility_type").order("name");
    if (!error && data) {
      setFacilities(data);
      setForm((f) => ({ ...f, facilityId: f.facilityId || data[0]?.id || "" }));
      setEncounterDraft((d) => ({ ...d, facilityId: d.facilityId || data[0]?.id || "" }));
    }
  }, []);

  const loadAudit = useCallback(async () => {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*, patients:patient_id(full_name), app_users:actor_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setAudit(data || []);
  }, []);

  const loadProgrammes = useCallback(async () => {
    const { data, error } = await supabase
      .from("health_programmes")
      .select("*")
      .eq("state_instance_id", profile.state_instance_id)
      .order("created_at", { ascending: false });
    if (!error) setProgrammes(data || []);
  }, [profile.state_instance_id]);

  const loadStaffAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_users")
      .select("*, facilities:facility_id(name)")
      .eq("state_instance_id", profile.state_instance_id)
      .order("created_at", { ascending: false });
    if (!error) setStaffAccounts(data || []);
  }, [profile.state_instance_id]);

  useEffect(() => {
    loadPatients();
    loadFacilities();
    loadAudit();
    loadProgrammes();
    loadStaffAccounts();
  }, [loadPatients, loadFacilities, loadAudit, loadProgrammes, loadStaffAccounts]);

  useEffect(() => {
    if (!selectedId) {
      setEncounters([]);
      setAllergies([]);
      setProblems([]);
      setMedications([]);
      setCareGaps([]);
      setWarnings([]);
      setDocuments([]);
      setReferrals([]);
      setInvestigations([]);
      setSmsNotifications([]);
      setImmunizations([]);
      return;
    }
    supabase
      .from("encounters")
      .select("*, facilities:facility_id(name)")
      .eq("patient_id", selectedId)
      .order("encounter_date", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setEncounters(data || []);
      });
    supabase
      .from("allergies")
      .select("*")
      .eq("patient_id", selectedId)
      .order("recorded_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setAllergies(data || []);
      });
    supabase
      .from("problems")
      .select("*")
      .eq("patient_id", selectedId)
      .order("onset_date", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setProblems(data || []);
      });
    supabase
      .from("medication_records")
      .select("*")
      .eq("patient_id", selectedId)
      .order("prescribed_date", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setMedications(data || []);
      });
    supabase
      .from("care_gaps")
      .select("*")
      .eq("patient_id", selectedId)
      .then(({ data, error }) => {
        if (!error) setCareGaps(data || []);
      });
    supabase
      .from("patient_warnings")
      .select("*")
      .eq("patient_id", selectedId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setWarnings(data || []);
      });
    supabase
      .from("immunizations")
      .select("*")
      .eq("patient_id", selectedId)
      .order("date_given", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setImmunizations(data || []);
      });
    supabase
      .from("documents")
      .select("*")
      .eq("patient_id", selectedId)
      .order("uploaded_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setDocuments(data || []);
      });
    supabase
      .from("referrals")
      .select("*, to_facilities:to_facility_id(name)")
      .eq("patient_id", selectedId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setReferrals(data || []);
      });
    supabase
      .from("investigations")
      .select("*")
      .eq("patient_id", selectedId)
      .order("requested_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setInvestigations(data || []);
      });
    supabase
      .from("sms_notifications")
      .select("*")
      .eq("patient_id", selectedId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!error) setSmsNotifications(data || []);
      });
    // Log the view for audit purposes
    supabase.from("audit_log").insert({
      actor_id: profile.id,
      patient_id: selectedId,
      action: "Viewed record",
      resource: "patients",
    }).then(() => loadAudit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const reloadMedications = useCallback(() => {
    if (!selectedId) return;
    supabase.from("medication_records").select("*").eq("patient_id", selectedId).order("prescribed_date", { ascending: false })
      .then(({ data, error }) => { if (!error) setMedications(data || []); });
  }, [selectedId]);

  const reloadSmsNotifications = useCallback(() => {
    if (!selectedId) return;
    supabase.from("sms_notifications").select("*").eq("patient_id", selectedId).order("created_at", { ascending: false }).limit(10)
      .then(({ data, error }) => { if (!error) setSmsNotifications(data || []); });
  }, [selectedId]);

  const reloadCareGaps = useCallback(() => {
    if (!selectedId) return;
    supabase.from("care_gaps").select("*").eq("patient_id", selectedId)
      .then(({ data, error }) => { if (!error) setCareGaps(data || []); });
  }, [selectedId]);

  const reloadWarnings = useCallback(() => {
    if (!selectedId) return;
    supabase.from("patient_warnings").select("*").eq("patient_id", selectedId).order("created_at", { ascending: false })
      .then(({ data, error }) => { if (!error) setWarnings(data || []); });
  }, [selectedId]);

  const reloadImmunizations = useCallback(() => {
    if (!selectedId) return;
    supabase.from("immunizations").select("*").eq("patient_id", selectedId).order("date_given", { ascending: false })
      .then(({ data, error }) => { if (!error) setImmunizations(data || []); });
  }, [selectedId]);

  const reloadDocuments = useCallback(() => {
    if (!selectedId) return;
    supabase.from("documents").select("*").eq("patient_id", selectedId).order("uploaded_at", { ascending: false })
      .then(({ data, error }) => { if (!error) setDocuments(data || []); });
  }, [selectedId]);

  const reloadReferrals = useCallback(() => {
    if (!selectedId) return;
    supabase.from("referrals").select("*, to_facilities:to_facility_id(name)").eq("patient_id", selectedId).order("created_at", { ascending: false })
      .then(({ data, error }) => { if (!error) setReferrals(data || []); });
  }, [selectedId]);

  const reloadInvestigations = useCallback(() => {
    if (!selectedId) return;
    supabase.from("investigations").select("*").eq("patient_id", selectedId).order("requested_at", { ascending: false })
      .then(({ data, error }) => { if (!error) setInvestigations(data || []); });
  }, [selectedId]);

  async function handleAddReferral(e) {
    e.preventDefault();
    if (!referralDraft.reason.trim()) {
      showToast("Enter a reason for the referral.");
      return;
    }
    setSavingReferral(true);
    const referringFacilityId = form.facilityId || facilities[0]?.id || null;
    const { data, error } = await supabase.from("referrals").insert({
      patient_id: selectedId,
      referring_facility_id: referringFacilityId,
      referred_by: profile.id,
      to_facility_id: referralDraft.toFacilityId || null,
      specialty: referralDraft.specialty.trim() || null,
      reason: referralDraft.reason.trim(),
      clinical_details: referralDraft.clinicalDetails.trim() || null,
      urgency: referralDraft.urgency,
    }).select().single();
    setSavingReferral(false);
    if (error) { showToast(`Failed to save referral: ${error.message}`); return; }
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Made referral", resource: "referrals",
      justification: referralDraft.reason.trim(),
    });
    setReferralDraft({ toFacilityId: "", specialty: "", reason: "", clinicalDetails: "", urgency: "routine" });
    setInvDraft((d) => ({ ...d, referralId: data.id }));
    reloadReferrals();
    loadAudit();
  }

  async function handleAddInvestigation(e) {
    e.preventDefault();
    if (!invDraft.testName.trim()) return;
    setSavingInv(true);
    const { error } = await supabase.from("investigations").insert({
      patient_id: selectedId,
      referral_id: invDraft.referralId || null,
      test_name: invDraft.testName.trim(),
      category: invDraft.category,
      requested_by: profile.id,
      facility_id: form.facilityId || facilities[0]?.id || null,
    });
    setSavingInv(false);
    if (error) { showToast(`Failed to request investigation: ${error.message}`); return; }
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Requested investigation", resource: "investigations",
      justification: invDraft.testName.trim(),
    });
    setInvDraft({ testName: "", category: "other", referralId: invDraft.referralId });
    reloadInvestigations();
    loadAudit();
  }

  async function handleCompleteInvestigation(invId) {
    const resultText = resultDrafts[invId] || "";
    const { error } = await supabase.from("investigations").update({
      status: "completed",
      result_summary: resultText.trim() || null,
      completed_at: new Date().toISOString(),
    }).eq("id", invId);
    if (error) { showToast(`Failed to update: ${error.message}`); return; }
    reloadInvestigations();
    reloadCareGaps();
  }

  async function handleUploadDocument(e) {
    e.preventDefault();
    if (!docDraft.file || !docDraft.title.trim()) {
      showToast("Choose a file and enter a title first.");
      return;
    }
    setUploadingDoc(true);
    const path = `${profile.state_instance_id}/${selectedId}/${Date.now()}_${docDraft.file.name}`;
    const { error: uploadErr } = await supabase.storage.from("patient-documents").upload(path, docDraft.file);
    if (uploadErr) {
      setUploadingDoc(false);
      showToast(`Upload failed: ${uploadErr.message}`);
      return;
    }
    const { error: dbErr } = await supabase.from("documents").insert({
      patient_id: selectedId,
      document_type: docDraft.documentType,
      title: docDraft.title.trim(),
      storage_path: path,
      file_name: docDraft.file.name,
      uploaded_by: profile.id,
    });
    setUploadingDoc(false);
    if (dbErr) {
      showToast(`Saved file but failed to record it: ${dbErr.message}`);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Uploaded document", resource: "documents",
      justification: docDraft.title.trim(),
    });
    setDocDraft({ title: "", documentType: "lab_result", file: null });
    reloadDocuments();
    loadAudit();
    showToast("Document uploaded.");
  }

  async function handleDownloadDocument(doc) {
    const { data, error } = await supabase.storage.from("patient-documents").createSignedUrl(doc.storage_path, 60);
    if (error) {
      showToast(`Could not open file: ${error.message}`);
      return;
    }
    window.open(data.signedUrl, "_blank");
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Viewed document", resource: "documents",
      justification: doc.title,
    });
    loadAudit();
  }

  async function handleAddWarning(e) {
    e.preventDefault();
    if (!warningDraft.trim()) return;
    setSavingWarning(true);
    const { error } = await supabase.from("patient_warnings").insert({
      patient_id: selectedId,
      warning_text: warningDraft.trim(),
      recorded_by: profile.id,
    });
    setSavingWarning(false);
    if (error) { showToast(`Failed to add warning: ${error.message}`); return; }
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Added patient warning", resource: "patient_warnings",
      justification: warningDraft.trim(),
    });
    setWarningDraft("");
    reloadWarnings();
    loadAudit();
  }

  async function handleAddImmunization(e) {
    e.preventDefault();
    if (!immDraft.vaccineName.trim()) return;
    setSavingImm(true);
    const { error } = await supabase.from("immunizations").insert({
      patient_id: selectedId,
      vaccine_name: immDraft.vaccineName.trim(),
      dose_number: immDraft.doseNumber ? parseInt(immDraft.doseNumber, 10) : null,
      date_given: immDraft.dateGiven,
      administered_by: profile.id,
      facility_id: form.facilityId || facilities[0]?.id || null,
    });
    setSavingImm(false);
    if (error) { showToast(`Failed to add immunisation: ${error.message}`); return; }
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Recorded immunisation", resource: "immunizations",
      justification: immDraft.vaccineName.trim(),
    });
    setImmDraft({ vaccineName: "", doseNumber: "", dateGiven: new Date().toISOString().slice(0, 10) });
    reloadImmunizations();
    loadAudit();
  }

  const reloadEncounters = useCallback(() => {
    if (!selectedId) return;
    supabase.from("encounters").select("*, facilities:facility_id(name)").eq("patient_id", selectedId).order("encounter_date", { ascending: false })
      .then(({ data, error }) => { if (!error) setEncounters(data || []); });
  }, [selectedId]);

  async function handleSelectPatient(p) {
    setPatientSubTab("summary");
    const { data: hasRelationship, error } = await supabase.rpc("has_patient_relationship", { p_patient_id: p.id });
    if (error) {
      // Fail safe toward requiring justification rather than silently granting access.
      setBreakGlassPrompt({ patientId: p.id, patientName: p.full_name });
      return;
    }
    if (hasRelationship) {
      setEmergencyPatientIds((prev) => {
        if (!prev[p.id]) return prev;
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
      setSelectedId(p.id);
    } else {
      setBreakGlassPrompt({ patientId: p.id, patientName: p.full_name });
    }
  }

  async function handleSubmitBreakGlass(e) {
    e.preventDefault();
    if (!breakGlassReason.trim()) {
      showToast("A reason is required to access this record.");
      return;
    }
    setBreakGlassSubmitting(true);
    const target = patients.find((p) => p.id === breakGlassPrompt.patientId);

    await supabase.from("audit_log").insert({
      actor_id: profile.id,
      patient_id: breakGlassPrompt.patientId,
      action: "Break-glass access",
      resource: "patients",
      justification: breakGlassReason.trim(),
      is_break_glass: true,
      patient_notified: !!target?.phone,
    });

    if (target?.phone) {
      const message = `NaijaHealth: Your health record was accessed by a facility outside your usual care team. Reason given: ${breakGlassReason.trim()}. Contact your state health authority with any concerns.`;
      const { data: notif } = await supabase.from("sms_notifications").insert({
        patient_id: breakGlassPrompt.patientId,
        phone_number: target.phone,
        message_body: message,
      }).select().single();
      if (notif) {
        supabase.functions.invoke("send-sms", { body: { notificationId: notif.id } }).catch(() => {});
      }
    }

    setEmergencyPatientIds((prev) => ({ ...prev, [breakGlassPrompt.patientId]: true }));
    setBreakGlassSubmitting(false);
    setSelectedId(breakGlassPrompt.patientId);
    setBreakGlassPrompt(null);
    setBreakGlassReason("");
    loadAudit();
  }

  async function handleChangeStaffRole(userId, newRole) {
    setStaffUpdating((s) => ({ ...s, [userId]: true }));
    const { error } = await supabase.from("app_users").update({ role: newRole }).eq("id", userId);
    setStaffUpdating((s) => ({ ...s, [userId]: false }));
    if (error) { showToast(`Failed to update role: ${error.message}`); return; }
    loadStaffAccounts();
  }

  async function handleToggleStaffActive(userId, isActive) {
    if (userId === profile.id && isActive) {
      showToast("You can't deactivate your own account.");
      return;
    }
    setStaffUpdating((s) => ({ ...s, [userId]: true }));
    const { error } = await supabase.from("app_users").update({ is_active: !isActive }).eq("id", userId);
    setStaffUpdating((s) => ({ ...s, [userId]: false }));
    if (error) { showToast(`Failed to update: ${error.message}`); return; }
    loadStaffAccounts();
  }

  async function handleAddMedication(e) {
    e.preventDefault();
    if (!medDraft.drugName.trim()) return;
    setSavingMed(true);
    const { data: newMed, error } = await supabase.from("medication_records").insert({
      patient_id: selectedId,
      drug_name: medDraft.drugName.trim(),
      dosage: medDraft.dosage.trim() || null,
      rx_type: medDraft.rxType,
      duration_days: medDraft.durationDays ? parseInt(medDraft.durationDays, 10) : null,
      quantity: medDraft.quantity.trim() || null,
      dispensing_facility_id: form.facilityId || facilities[0]?.id || null,
    }).select().single();
    setSavingMed(false);
    if (error) {
      showToast(`Failed to add medication: ${error.message}`);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Prescribed medication", resource: "medication_records",
      justification: `${medDraft.drugName.trim()} (${medDraft.rxType})`,
    });

    // Text the prescription to the patient's phone, if one is on file.
    // Provider-agnostic: which vendor actually sends it is a backend config
    // choice, not something the frontend needs to know about.
    if (selected?.phone) {
      const message = `NaijaHealth: You have been prescribed ${medDraft.drugName.trim()}${medDraft.dosage.trim() ? ` (${medDraft.dosage.trim()})` : ""}. Please collect from your facility. Questions? Contact your clinic.`;
      const { data: notif, error: notifErr } = await supabase.from("sms_notifications").insert({
        patient_id: selectedId,
        medication_record_id: newMed.id,
        phone_number: selected.phone,
        message_body: message,
      }).select().single();
      if (!notifErr && notif) {
        supabase.functions.invoke("send-sms", { body: { notificationId: notif.id } })
          .catch(() => {
            // Non-fatal: the notification row still records the attempt/failure server-side.
          })
          .finally(() => reloadSmsNotifications());
      }
    }

    setMedDraft({ drugName: "", dosage: "", rxType: "acute", durationDays: "", quantity: "" });
    reloadMedications();
    loadAudit();
  }

  async function handleAddProgramme(e) {
    e.preventDefault();
    if (!programmeDraft.title.trim() || !programmeDraft.description.trim()) {
      showToast("Title and description are required.");
      return;
    }
    setSavingProgramme(true);
    const { error } = await supabase.from("health_programmes").insert({
      state_instance_id: profile.state_instance_id,
      title: programmeDraft.title.trim(),
      description: programmeDraft.description.trim(),
      start_date: programmeDraft.startDate || null,
      end_date: programmeDraft.endDate || null,
      created_by: profile.id,
    });
    setSavingProgramme(false);
    if (error) {
      showToast(`Failed to save: ${error.message}`);
      return;
    }
    setProgrammeDraft({ title: "", description: "", startDate: "", endDate: "" });
    loadProgrammes();
  }

  async function handleToggleProgramme(id, isActive) {
    const { error } = await supabase.from("health_programmes").update({ is_active: !isActive }).eq("id", id);
    if (error) { showToast(`Failed to update: ${error.message}`); return; }
    loadProgrammes();
  }

  async function runIsolationTest() {
    setIsolationRunning(true);
    setIsolationResult(null);
    try {
      // Find a state that is NOT the current user's state
      const { data: states, error: stateErr } = await supabase.from("state_instances").select("id, state_name");
      if (stateErr) throw stateErr;
      const otherState = (states || []).find((s) => s.id !== profile.state_instance_id);
      if (!otherState) {
        setIsolationResult({ ok: false, message: "No other state configured to test against." });
        setIsolationRunning(false);
        return;
      }

      // 1. Query with no state filter at all — RLS should silently restrict to our own state
      const { data: unfiltered, error: unfilteredErr } = await supabase.from("patients").select("id, full_name, address_state");
      if (unfilteredErr) throw unfilteredErr;
      const leakedRows = (unfiltered || []).filter((p) => p.address_state !== stateName);

      // 2. Explicitly ask for another state's patients by their real state_instance_id
      const { data: explicit, error: explicitErr } = await supabase.from("patients").select("id, full_name").eq("state_instance_id", otherState.id);
      if (explicitErr) throw explicitErr;

      setIsolationResult({
        ok: true,
        ownStateCount: (unfiltered || []).length,
        otherStateName: otherState.state_name,
        leakedRows: leakedRows.length,
        explicitAttemptRows: (explicit || []).length,
      });
    } catch (err) {
      setIsolationResult({ ok: false, message: err.message });
    }
    setIsolationRunning(false);
  }

  async function runAuditTamperTest() {
    setTamperRunning(true);
    setTamperResult(null);
    if (!audit[0]?.id) {
      setTamperResult({ ok: false, message: "No audit log entry available to test against yet — view or register a patient first." });
      setTamperRunning(false);
      return;
    }
    const { error } = await supabase.from("audit_log").update({ action: "TAMPER_TEST" }).eq("id", audit[0].id);
    setTamperRunning(false);
    if (error) {
      setTamperResult({ ok: true, message: error.message });
    } else {
      setTamperResult({ ok: false, message: "Update succeeded — this should not happen." });
    }
  }

  async function handleAddEncounter(e) {
    e.preventDefault();
    if (!encounterDraft.facilityId) {
      showToast("Select a facility for this consultation.");
      return;
    }
    setSavingEncounter(true);
    const { error } = await supabase.from("encounters").insert({
      patient_id: selectedId,
      facility_id: encounterDraft.facilityId,
      encounter_type: encounterDraft.encounterType,
      diagnosis: encounterDraft.diagnosis.trim() || null,
      history: encounterDraft.history.trim() || null,
      examination: encounterDraft.examination.trim() || null,
      comment: encounterDraft.comment.trim() || null,
    });
    setSavingEncounter(false);
    if (error) {
      showToast(`Failed to save consultation: ${error.message}`);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Recorded consultation", resource: "encounters",
      justification: encounterDraft.diagnosis.trim() || encounterDraft.encounterType,
    });
    setEncounterDraft((d) => ({ encounterType: "Consultation", diagnosis: "", history: "", examination: "", comment: "", facilityId: d.facilityId }));
    reloadEncounters();
    loadAudit();
    reloadCareGaps();
  }

  const reloadAllergies = useCallback(() => {
    if (!selectedId) return;
    supabase.from("allergies").select("*").eq("patient_id", selectedId).order("recorded_at", { ascending: false })
      .then(({ data, error }) => { if (!error) setAllergies(data || []); });
  }, [selectedId]);

  const reloadProblems = useCallback(() => {
    if (!selectedId) return;
    supabase.from("problems").select("*").eq("patient_id", selectedId).order("onset_date", { ascending: false })
      .then(({ data, error }) => { if (!error) setProblems(data || []); });
  }, [selectedId]);

  async function handleAddAllergy(e) {
    e.preventDefault();
    if (!allergyDraft.substance.trim()) return;
    setSavingAllergy(true);
    const { error } = await supabase.from("allergies").insert({
      patient_id: selectedId,
      substance: allergyDraft.substance.trim(),
      reaction: allergyDraft.reaction.trim() || null,
      recorded_by: profile.id,
    });
    setSavingAllergy(false);
    if (error) {
      showToast(`Failed to add allergy: ${error.message}`);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Recorded allergy", resource: "allergies",
      justification: allergyDraft.substance.trim(),
    });
    setAllergyDraft({ substance: "", reaction: "" });
    reloadAllergies();
    loadPatients();
    loadAudit();
  }

  async function handleAddProblem(e) {
    e.preventDefault();
    if (!problemDraft.description.trim()) return;
    setSavingProblem(true);
    const { error } = await supabase.from("problems").insert({
      patient_id: selectedId,
      description: problemDraft.description.trim(),
      significance: problemDraft.significance,
      onset_date: problemDraft.onsetDate || null,
      recorded_by: profile.id,
    });
    setSavingProblem(false);
    if (error) {
      showToast(`Failed to add problem: ${error.message}`);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: profile.id, patient_id: selectedId, action: "Added problem", resource: "problems",
      justification: problemDraft.description.trim(),
    });
    setProblemDraft({ description: "", significance: "significant", onsetDate: "" });
    reloadProblems();
    loadAudit();
    reloadCareGaps();
  }

  async function handleResolveProblem(problemId) {
    const { error } = await supabase.from("problems").update({ status: "resolved", resolved_date: new Date().toISOString().slice(0, 10) }).eq("id", problemId);
    if (error) { showToast(`Failed to update: ${error.message}`); return; }
    reloadProblems();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.full_name.toLowerCase().includes(q) || (p.nin && p.nin.includes(q))
    );
  }, [patients, query]);

  const selected = patients.find((p) => p.id === selectedId) || null;
  const isEmergencyView = !!emergencyPatientIds[selectedId];

  async function handleRegister(e) {
    e.preventDefault();
    const ninCheck = validateNIN(form.nin.trim());
    if (!ninCheck.valid) {
      setFormError(ninCheck.message);
      return;
    }
    if (!form.firstName.trim() || !form.surname.trim() || !form.dob) {
      setFormError("First name, surname, and date of birth are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    const { data, error } = await supabase
      .from("patients")
      .insert({
        state_instance_id: profile.state_instance_id,
        registering_facility_id: form.facilityId || null,
        nin: form.nin.trim() || null,
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim() || null,
        surname: form.surname.trim(),
        date_of_birth: form.dob,
        sex: form.sex,
        phone: form.phone.trim() || null,
        address_street: form.street.trim() || null,
        address_lga: form.lga.trim() || null,
        address_state: stateName,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setFormError(error.message.includes("duplicate") ? "A patient with this NIN is already registered." : error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: profile.id,
      patient_id: data.id,
      action: "Registered patient",
      resource: "patients",
      justification: data.nin ? "Identity: NIN" : "Identity: UHID (no NIN on file)",
    });
    setForm({ firstName: "", middleName: "", surname: "", nin: "", dob: "", sex: "Female", phone: "", street: "", lga: "", facilityId: form.facilityId });
    setSelectedId(data.id);
    setTab("patients");
    showToast(`Registered ${data.full_name}`);
    loadPatients();
    loadAudit();
  }

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: T.bg, color: T.ink, minHeight: "100vh", display: "flex", fontSize: 16,
    }}>
      {breakGlassPrompt && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,20,30,0.55)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{ background: T.surface, borderRadius: 14, padding: 26, maxWidth: 440, width: "100%" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.primaryDark, marginBottom: 6 }}>
              You don't have an existing relationship with this patient
            </div>
            <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 16, lineHeight: 1.5 }}>
              <strong>{breakGlassPrompt.patientName}</strong> wasn't registered at your facility and has no
              recorded encounter there. You can still open this record — state-wide access is by design — but
              a reason is required, and this access will be logged and flagged for review.
            </div>
            <form onSubmit={handleSubmitBreakGlass}>
              <textarea
                autoFocus
                style={{ ...inputStyle, minHeight: 70, fontFamily: "inherit", marginBottom: 12 }}
                placeholder="Reason, e.g. Emergency presentation, Patient referred to me…"
                value={breakGlassReason}
                onChange={(e) => setBreakGlassReason(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => { setBreakGlassPrompt(null); setBreakGlassReason(""); }}
                  style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 16px", fontSize: 15, color: T.inkSoft, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={breakGlassSubmitting}
                  style={{ background: T.danger, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                >
                  {breakGlassSubmitting ? "Opening…" : "Access record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ width: 220, background: T.primaryDark, color: "#EAF3F0", padding: "20px 14px", display: "flex", flexDirection: "column" }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 2 }}>NaijaHealth Record</div>
        <div style={{ fontSize: 13.5, color: "#9FC3B8", marginBottom: 14 }}>Live backend · {stateName}</div>

        <div style={{ fontSize: 15, color: "#9FC3B8", lineHeight: 1.5, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
          {board}<br />Insurance: {scheme}
        </div>

        <div style={{ background: "rgba(217,160,60,0.18)", border: "1px solid rgba(217,160,60,0.4)", borderRadius: 6, padding: "6px 9px", fontSize: 14.5, color: "#F0D9A6", marginBottom: 16, lineHeight: 1.4 }}>
          Prototype / demonstration system — not yet certified for handling real patient records.
        </div>

        {[
          { key: "patients", label: "Patients" },
          { key: "register", label: "Register new patient" },
          { key: "audit", label: "Audit log" },
          { key: "protection", label: "Data protection" },
          ...(profile.role === "admin" ? [{ key: "programmes", label: "Reminders" }, { key: "users", label: "Staff accounts" }] : []),
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              textAlign: "left", padding: "9px 10px", borderRadius: 8, border: "none",
              marginBottom: 4, cursor: "pointer", fontSize: 15.5, fontWeight: 600,
              background: tab === item.key ? "rgba(255,255,255,0.14)" : "transparent",
              color: tab === item.key ? "#fff" : "#BFDCD3",
            }}
          >
            {item.label}
          </button>
        ))}

        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{profile.full_name}</div>
          <div style={{ fontSize: 15, color: "#9FC3B8", marginBottom: 10, textTransform: "capitalize" }}>{profile.role.replace("_", " ")}</div>
          <button onClick={signOut} style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "#EAF3F0",
            padding: "6px 10px", borderRadius: 7, fontSize: 14, cursor: "pointer", width: "100%",
          }}>Sign out</button>
        </div>
      </div>

      <div style={{ flex: 1, padding: 22, position: "relative", overflowY: "auto" }}>
        {toast && (
          <div style={{
            position: "absolute", top: 16, right: 22, background: T.primary, color: "#fff",
            padding: "9px 14px", borderRadius: 8, fontSize: 15, fontWeight: 600, boxShadow: "0 4px 14px rgba(0,0,0,0.15)", zIndex: 10,
          }}>{toast}</div>
        )}

        {tab === "patients" && (
          <div style={{ display: "flex", gap: 18 }}>
            <div style={{ width: 300, flexShrink: 0 }}>
              <input
                placeholder="Search by name or NIN…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ ...inputStyle, marginBottom: 12 }}
              />
              {patientsLoading ? (
                <div style={{ fontSize: 15, color: T.inkSoft }}>Loading…</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      style={{
                        textAlign: "left", padding: 12, borderRadius: 10, cursor: "pointer",
                        border: `1px solid ${p.id === selectedId ? T.primary : T.border}`,
                        background: p.id === selectedId ? T.primarySoft : T.surface,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                        {p.full_name}
                        {p.allergies && p.allergies.length > 0 && (
                          <span style={{ color: T.danger, marginLeft: 6, fontSize: 15 }} title="Has recorded allergies">⚠</span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 2 }}>
                        {p.nin ? `NIN ${p.nin}` : "No NIN on file"}
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div style={{ fontSize: 15, color: T.inkSoft, padding: 12 }}>
                      {query ? `No patients match "${query}".` : `No patients registered in ${stateName} yet.`}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
              {!selected ? (
                <div style={{ color: T.inkSoft }}>Select a patient to view their record.</div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 21, fontWeight: 800 }}>{selected.full_name}</div>
                      <div style={{ fontSize: 14.5, color: T.inkSoft, marginTop: 3 }}>
                        UHID {selected.id.slice(0, 8)} · DOB {selected.date_of_birth} · {selected.sex}
                      </div>
                    </div>
                    {selected.nin ? <Badge tone="primary">NIN on file</Badge> : <Badge tone="amber">No NIN — UHID only</Badge>}
                  </div>

                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 14, marginBottom: 4, borderBottom: `1px solid ${T.border}` }}>
                    {(isEmergencyView ? [{ key: "summary", label: "Summary" }] : [
                      { key: "summary", label: "Summary" },
                      { key: "consultations", label: "Consultations" },
                      { key: "medication", label: "Medication" },
                      { key: "problems", label: "Problems" },
                      { key: "investigations", label: "Investigations" },
                      { key: "careHistory", label: "Care History" },
                      { key: "diary", label: "Diary" },
                      { key: "documents", label: "Documents" },
                      { key: "referrals", label: "Referrals" },
                    ]).map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setPatientSubTab(t.key)}
                        style={{
                          background: "none", border: "none", borderBottom: patientSubTab === t.key ? `2px solid ${T.primary}` : "2px solid transparent",
                          padding: "8px 12px", fontSize: 14, fontWeight: patientSubTab === t.key ? 700 : 500,
                          color: patientSubTab === t.key ? T.primary : T.inkSoft, cursor: "pointer", marginBottom: -1,
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {patientSubTab === "summary" && isEmergencyView && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ background: T.dangerSoft, border: `1px solid ${T.danger}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.danger }}>Limited emergency view</div>
                        <div style={{ fontSize: 14, color: T.danger, marginTop: 2 }}>
                          Accessed via break-glass — shown here is only what's relevant to emergency care: allergies,
                          active problems, and current medications. Full record access isn't granted by break-glass.
                        </div>
                      </div>

                      {allergies.length > 0 ? (
                        <div style={{ background: T.dangerSoft, border: `1px solid ${T.danger}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.danger, marginBottom: 4 }}>⚠ ALLERGIES</div>
                          {allergies.map((a) => (
                            <div key={a.id} style={{ fontSize: 15, color: T.danger }}>
                              Adverse reaction to <strong>{a.substance}</strong>{a.reaction ? ` — ${a.reaction}` : ""}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 15, color: T.inkSoft, marginBottom: 14 }}>No allergies recorded.</div>
                      )}

                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Active problems</div>
                      {problems.filter((p) => p.status === "active").length === 0 ? (
                        <div style={{ fontSize: 15, color: T.inkSoft, marginBottom: 14 }}>None recorded.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                          {problems.filter((p) => p.status === "active").map((p) => (
                            <div key={p.id} style={{ fontSize: 15 }}>{p.description} <span style={{ color: T.inkSoft, fontStyle: "italic" }}>({p.significance})</span></div>
                          ))}
                        </div>
                      )}

                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Current medications</div>
                      {medications.length === 0 ? (
                        <div style={{ fontSize: 15, color: T.inkSoft }}>None recorded.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {medications.map((m) => (
                            <div key={m.id} style={{ fontSize: 15 }}>{m.drug_name}{m.dosage ? ` — ${m.dosage}` : ""} <span style={{ color: T.inkSoft, fontStyle: "italic" }}>({m.rx_type})</span></div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {patientSubTab === "summary" && !isEmergencyView && (
                    <>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 14, color: T.inkSoft }}>
                        <span>Active problems: <strong style={{ color: T.ink }}>{problems.filter((p) => p.status === "active").length}</strong></span>
                        <span>Medications: <strong style={{ color: T.ink }}>{medications.filter((m) => m.rx_type === "acute").length} acute / {medications.filter((m) => m.rx_type === "repeat").length} repeat</strong></span>
                        <span>Allergies: <strong style={{ color: allergies.length ? T.danger : T.ink }}>{allergies.length}</strong></span>
                        <span>Immunisations: <strong style={{ color: T.ink }}>{immunizations.length}</strong></span>
                        <span>Documents: <strong style={{ color: T.ink }}>{documents.length}</strong></span>
                        <span>Investigations: <strong style={{ color: T.ink }}>{investigations.filter((i) => i.status === "requested").length} open</strong></span>
                        <span>Referrals: <strong style={{ color: T.ink }}>{referrals.filter((r) => r.status === "pending").length} pending</strong></span>
                        <span>Care gaps: <strong style={{ color: careGaps.length ? T.amber : T.ink }}>{careGaps.length}</strong></span>
                        <span>Warnings: <strong style={{ color: warnings.length ? T.primaryDark : T.ink }}>{warnings.length}</strong></span>
                      </div>

                      {warnings.length > 0 && (
                        <div style={{ background: "#F1ECF9", border: "1px solid #9B7FC7", borderRadius: 8, padding: "10px 12px", marginTop: 10 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#5B3E8C", marginBottom: 4 }}>WARNINGS</div>
                          {warnings.map((w) => (
                            <div key={w.id} style={{ fontSize: 15, color: "#5B3E8C" }}>{w.warning_text}</div>
                          ))}
                        </div>
                      )}

                      {allergies.length > 0 && (
                        <div style={{ background: T.dangerSoft, border: `1px solid ${T.danger}`, borderRadius: 8, padding: "10px 12px", marginTop: 14 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.danger, marginBottom: 4 }}>⚠ ALLERGIES</div>
                          {allergies.map((a) => (
                            <div key={a.id} style={{ fontSize: 15, color: T.danger }}>
                              Adverse reaction to <strong>{a.substance}</strong>{a.reaction ? ` — ${a.reaction}` : ""}
                            </div>
                          ))}
                        </div>
                      )}

                      {careGaps.length > 0 && (
                        <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 8, padding: "10px 12px", marginTop: 10 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.amber, marginBottom: 4 }}>CARE GAPS</div>
                          {careGaps.map((g) => (
                            <div key={g.gap_type} style={{ fontSize: 15, color: "#7A4E13" }}>{g.message}</div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 28, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                        <div>
                          <div style={{ fontSize: 13.5, color: T.inkSoft, fontWeight: 600 }}>ADDRESS</div>
                          <div style={{ fontSize: 15.5, marginTop: 3 }}>
                            {[selected.address_street, selected.address_lga, selected.address_state].filter(Boolean).join(", ") || "—"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13.5, color: T.inkSoft, fontWeight: 600 }}>PHONE</div>
                          <div style={{ fontSize: 15.5, marginTop: 3 }}>{selected.phone || "—"}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {patientSubTab === "problems" && !isEmergencyView && (
                    <div style={{ marginTop: 16 }}>
                      {problems.filter((p) => p.status === "active").length === 0 ? (
                        <div style={{ fontSize: 15, color: T.inkSoft, marginBottom: 10 }}>No active problems recorded.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                          {problems.filter((p) => p.status === "active").map((p) => (
                            <div key={p.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <span style={{ fontSize: 15, fontWeight: 600 }}>{p.description}</span>
                                <span style={{ fontSize: 14, color: T.inkSoft, marginLeft: 8, fontStyle: "italic" }}>({p.significance})</span>
                                {p.onset_date && <span style={{ fontSize: 14, color: T.inkSoft, marginLeft: 8 }}>since {p.onset_date}</span>}
                              </div>
                              <button onClick={() => handleResolveProblem(p.id)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 13.5, color: T.inkSoft, cursor: "pointer" }}>
                                Mark resolved
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {problems.filter((p) => p.status === "resolved").length > 0 && (
                        <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 10 }}>
                          Resolved: {problems.filter((p) => p.status === "resolved").map((p) => p.description).join(", ")}
                        </div>
                      )}
                      <form onSubmit={handleAddProblem} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input style={{ ...inputStyle, flex: 1 }} placeholder="Add a problem, e.g. Hypertension" value={problemDraft.description} onChange={(e) => setProblemDraft({ ...problemDraft, description: e.target.value })} />
                        <select style={{ ...inputStyle, width: 120 }} value={problemDraft.significance} onChange={(e) => setProblemDraft({ ...problemDraft, significance: e.target.value })}>
                          <option value="significant">Significant</option>
                          <option value="minor">Minor</option>
                        </select>
                        <input type="date" style={{ ...inputStyle, width: 150 }} value={problemDraft.onsetDate} onChange={(e) => setProblemDraft({ ...problemDraft, onsetDate: e.target.value })} />
                        <button type="submit" disabled={savingProblem} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
                      </form>
                    </div>
                  )}

                  {patientSubTab === "careHistory" && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Allergies</div>
                      <form onSubmit={handleAddAllergy} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                        <input style={{ ...inputStyle, flex: 1 }} placeholder="Substance, e.g. Penicillin" value={allergyDraft.substance} onChange={(e) => setAllergyDraft({ ...allergyDraft, substance: e.target.value })} />
                        <input style={{ ...inputStyle, flex: 1 }} placeholder="Reaction (optional)" value={allergyDraft.reaction} onChange={(e) => setAllergyDraft({ ...allergyDraft, reaction: e.target.value })} />
                        <button type="submit" disabled={savingAllergy} style={{ background: T.danger, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
                      </form>

                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, marginTop: 20 }}>Warnings <span style={{ fontWeight: 400, color: T.inkSoft, fontSize: 14 }}>(administrative — e.g. contact preferences, access notes)</span></div>
                      <form onSubmit={handleAddWarning} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input style={{ ...inputStyle, flex: 1 }} placeholder="e.g. Book appointments only through front desk" value={warningDraft} onChange={(e) => setWarningDraft(e.target.value)} />
                        <button type="submit" disabled={savingWarning} style={{ background: "#5B3E8C", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
                      </form>

                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, marginTop: 20 }}>Immunisations</div>
                      {immunizations.length === 0 ? (
                        <div style={{ fontSize: 15, color: T.inkSoft, marginBottom: 10 }}>None recorded.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                          {immunizations.map((i) => (
                            <div key={i.id} style={{ fontSize: 15 }}>
                              {i.vaccine_name}{i.dose_number ? ` (dose ${i.dose_number})` : ""} — <span style={{ color: T.inkSoft }}>{i.date_given}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <form onSubmit={handleAddImmunization} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input style={{ ...inputStyle, flex: 1 }} placeholder="Vaccine, e.g. MMR" value={immDraft.vaccineName} onChange={(e) => setImmDraft({ ...immDraft, vaccineName: e.target.value })} />
                        <input type="number" style={{ ...inputStyle, width: 90 }} placeholder="Dose #" value={immDraft.doseNumber} onChange={(e) => setImmDraft({ ...immDraft, doseNumber: e.target.value })} />
                        <input type="date" style={{ ...inputStyle, width: 150 }} value={immDraft.dateGiven} onChange={(e) => setImmDraft({ ...immDraft, dateGiven: e.target.value })} />
                        <button type="submit" disabled={savingImm} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
                      </form>
                    </div>
                  )}

                  {patientSubTab === "documents" && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 10 }}>e.g. a private test result the patient brought in</div>
                      {documents.length === 0 ? (
                        <div style={{ fontSize: 15, color: T.inkSoft, marginBottom: 10 }}>No documents on file.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                          {documents.map((d) => (
                            <div key={d.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <span style={{ fontSize: 15, fontWeight: 600 }}>{d.title}</span>
                                <span style={{ fontSize: 14, color: T.inkSoft, marginLeft: 8 }}>{d.document_type.replace("_", " ")} · {new Date(d.uploaded_at).toLocaleDateString()}</span>
                              </div>
                              <button onClick={() => handleDownloadDocument(d)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 13.5, color: T.primary, cursor: "pointer", fontWeight: 600 }}>
                                Open
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <form onSubmit={handleUploadDocument} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} placeholder="Title, e.g. HbA1c result 12 Sep" value={docDraft.title} onChange={(e) => setDocDraft({ ...docDraft, title: e.target.value })} />
                        <select style={{ ...inputStyle, width: 140 }} value={docDraft.documentType} onChange={(e) => setDocDraft({ ...docDraft, documentType: e.target.value })}>
                          <option value="lab_result">Lab result</option>
                          <option value="referral">Referral</option>
                          <option value="imaging">Imaging</option>
                          <option value="other">Other</option>
                        </select>
                        <input type="file" onChange={(e) => setDocDraft({ ...docDraft, file: e.target.files[0] || null })} style={{ fontSize: 14 }} />
                        <button type="submit" disabled={uploadingDoc} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                          {uploadingDoc ? "Uploading…" : "Upload"}
                        </button>
                      </form>
                    </div>
                  )}

                  {patientSubTab === "investigations" && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 10 }}>Tests requested for this patient — either tied to a referral above, or ordered directly.</div>
                      {investigations.length === 0 ? (
                        <div style={{ fontSize: 15, color: T.inkSoft, marginBottom: 10 }}>No investigations requested yet.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                          {investigations.map((inv) => (
                            <div key={inv.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <span style={{ fontSize: 15, fontWeight: 600 }}>{inv.test_name}</span>
                                  <span style={{ fontSize: 13, color: T.inkSoft, marginLeft: 8, textTransform: "capitalize" }}>{inv.category}</span>
                                  {inv.referral_id && <Badge tone="primary">Linked to referral</Badge>}
                                </div>
                                <Badge tone={inv.status === "completed" ? "primary" : "amber"}>{inv.status}</Badge>
                              </div>
                              {inv.status === "completed" ? (
                                <div style={{ fontSize: 14.5, marginTop: 6, color: T.inkSoft }}>
                                  Result: {inv.result_summary || "(no summary entered)"} — {new Date(inv.completed_at).toLocaleDateString()}
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                  <input
                                    style={{ ...inputStyle, flex: 1 }}
                                    placeholder="Result summary (optional)"
                                    value={resultDrafts[inv.id] || ""}
                                    onChange={(e) => setResultDrafts({ ...resultDrafts, [inv.id]: e.target.value })}
                                  />
                                  <button onClick={() => handleCompleteInvestigation(inv.id)} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>
                                    Mark completed
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <form onSubmit={handleAddInvestigation} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} placeholder="Test name, e.g. HbA1c" value={invDraft.testName} onChange={(e) => setInvDraft({ ...invDraft, testName: e.target.value })} />
                        <select style={{ ...inputStyle, width: 150 }} value={invDraft.category} onChange={(e) => setInvDraft({ ...invDraft, category: e.target.value })}>
                          <option value="biochemistry">Biochemistry</option>
                          <option value="haematology">Haematology</option>
                          <option value="microbiology">Microbiology</option>
                          <option value="imaging">Imaging</option>
                          <option value="other">Other</option>
                        </select>
                        <select style={{ ...inputStyle, width: 180 }} value={invDraft.referralId} onChange={(e) => setInvDraft({ ...invDraft, referralId: e.target.value })}>
                          <option value="">Not linked to a referral</option>
                          {referrals.map((r) => <option key={r.id} value={r.id}>Re: {r.reason.slice(0, 30)}</option>)}
                        </select>
                        <button type="submit" disabled={savingInv} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Request</button>
                      </form>
                    </div>
                  )}

                  {patientSubTab === "referrals" && (
                    <div style={{ marginTop: 16 }}>
                      {referrals.length === 0 ? (
                        <div style={{ fontSize: 15, color: T.inkSoft, marginBottom: 10 }}>No referrals on file.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                          {referrals.map((r) => (
                            <div key={r.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <span style={{ fontSize: 15, fontWeight: 600 }}>{r.reason}</span>
                                  {r.specialty && <span style={{ fontSize: 13, color: T.inkSoft, marginLeft: 8 }}>({r.specialty})</span>}
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <Badge tone={r.urgency === "two_week_wait" ? "amber" : "primary"}>{r.urgency.replace(/_/g, " ")}</Badge>
                                  <Badge tone={r.status === "pending" ? "amber" : "primary"}>{r.status}</Badge>
                                </div>
                              </div>
                              <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 4 }}>
                                To: {r.to_facilities?.name || "unspecified facility"} · {new Date(r.created_at).toLocaleDateString()}
                              </div>
                              {r.clinical_details && <div style={{ fontSize: 14.5, marginTop: 6 }}>{r.clinical_details}</div>}
                              {investigations.filter((i) => i.referral_id === r.id).length > 0 && (
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft, marginBottom: 4 }}>LINKED INVESTIGATIONS</div>
                                  {investigations.filter((i) => i.referral_id === r.id).map((i) => (
                                    <div key={i.id} style={{ fontSize: 14 }}>{i.test_name} — <span style={{ color: T.inkSoft }}>{i.status}</span></div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>New referral</div>
                      <form onSubmit={handleAddReferral}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <select style={{ ...inputStyle, flex: 1 }} value={referralDraft.toFacilityId} onChange={(e) => setReferralDraft({ ...referralDraft, toFacilityId: e.target.value })}>
                            <option value="">Refer to (facility, optional)</option>
                            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <input style={{ ...inputStyle, width: 180 }} placeholder="Specialty, e.g. Cardiology" value={referralDraft.specialty} onChange={(e) => setReferralDraft({ ...referralDraft, specialty: e.target.value })} />
                          <select style={{ ...inputStyle, width: 150 }} value={referralDraft.urgency} onChange={(e) => setReferralDraft({ ...referralDraft, urgency: e.target.value })}>
                            <option value="routine">Routine</option>
                            <option value="urgent">Urgent</option>
                            <option value="two_week_wait">Two-week wait</option>
                          </select>
                        </div>
                        <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Reason for referral" value={referralDraft.reason} onChange={(e) => setReferralDraft({ ...referralDraft, reason: e.target.value })} />
                        <textarea style={{ ...inputStyle, marginBottom: 8, minHeight: 44, fontFamily: "inherit" }} placeholder="Clinical details (optional)" value={referralDraft.clinicalDetails} onChange={(e) => setReferralDraft({ ...referralDraft, clinicalDetails: e.target.value })} />
                        <button type="submit" disabled={savingReferral} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                          {savingReferral ? "Saving…" : "Save referral"}
                        </button>
                      </form>
                    </div>
                  )}

                  {patientSubTab === "medication" && (
                    <div style={{ marginTop: 16 }}>
                      {(() => {
                        const acute = medications.filter((m) => m.rx_type === "acute");
                        const repeat = medications.filter((m) => m.rx_type === "repeat");
                        return (
                          <div style={{ display: "flex", gap: 24, marginBottom: 10, flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                              <div style={{ fontSize: 13.5, color: T.inkSoft, fontWeight: 600, marginBottom: 4 }}>ACUTE</div>
                              {acute.length === 0 ? <div style={{ fontSize: 15, color: T.inkSoft }}>None</div> : acute.map((m) => (
                                <div key={m.id} style={{ fontSize: 15, marginBottom: 3 }}>
                                  {m.drug_name}{m.dosage ? ` — ${m.dosage}` : ""}{m.duration_days ? ` (${m.duration_days}d)` : ""}
                                </div>
                              ))}
                            </div>
                            <div style={{ flex: 1, minWidth: 200 }}>
                              <div style={{ fontSize: 13.5, color: T.inkSoft, fontWeight: 600, marginBottom: 4 }}>REPEAT</div>
                              {repeat.length === 0 ? <div style={{ fontSize: 15, color: T.inkSoft }}>None</div> : repeat.map((m) => (
                                <div key={m.id} style={{ fontSize: 15, marginBottom: 3 }}>
                                  {m.drug_name}{m.dosage ? ` — ${m.dosage}` : ""}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      <form onSubmit={handleAddMedication} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <input style={{ ...inputStyle, flex: 2, minWidth: 140 }} placeholder="Drug name" value={medDraft.drugName} onChange={(e) => setMedDraft({ ...medDraft, drugName: e.target.value })} />
                        <input style={{ ...inputStyle, flex: 1, minWidth: 100 }} placeholder="Dosage" value={medDraft.dosage} onChange={(e) => setMedDraft({ ...medDraft, dosage: e.target.value })} />
                        <select style={{ ...inputStyle, width: 110 }} value={medDraft.rxType} onChange={(e) => setMedDraft({ ...medDraft, rxType: e.target.value })}>
                          <option value="acute">Acute</option>
                          <option value="repeat">Repeat</option>
                        </select>
                        <input type="number" style={{ ...inputStyle, width: 90 }} placeholder="Days" value={medDraft.durationDays} onChange={(e) => setMedDraft({ ...medDraft, durationDays: e.target.value })} />
                        <input style={{ ...inputStyle, width: 100 }} placeholder="Quantity" value={medDraft.quantity} onChange={(e) => setMedDraft({ ...medDraft, quantity: e.target.value })} />
                        <button type="submit" disabled={savingMed} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
                      </form>

                      {!selected?.phone && (
                        <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 10 }}>No phone number on file — prescriptions can't be texted to this patient.</div>
                      )}
                      {smsNotifications.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>PRESCRIPTION TEXT MESSAGES</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {smsNotifications.map((n) => (
                              <div key={n.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ color: T.inkSoft }}>{new Date(n.created_at).toLocaleString()} → {n.phone_number}</span>
                                {n.status === "sent" && <Badge tone="primary">Sent{n.provider_name ? ` via ${n.provider_name}` : ""}</Badge>}
                                {n.status === "failed" && <Badge tone="danger">Failed{n.error_message ? `: ${n.error_message.slice(0, 60)}` : ""}</Badge>}
                                {n.status === "pending" && <Badge tone="amber">Sending…</Badge>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {patientSubTab === "diary" && (
                    <div style={{ marginTop: 16 }}>
                      {careGaps.length === 0 ? (
                        <div style={{ fontSize: 15, color: T.inkSoft }}>No open care gaps for this patient right now.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {careGaps.map((g) => (
                            <div key={g.gap_type} style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, color: "#7A4E13" }}>
                              {g.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {patientSubTab === "consultations" && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Add consultation</div>
                      <form onSubmit={handleAddEncounter}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <select style={{ ...inputStyle, width: 170 }} value={encounterDraft.encounterType} onChange={(e) => setEncounterDraft({ ...encounterDraft, encounterType: e.target.value })}>
                            <option>Consultation</option>
                            <option>Telephone consultation</option>
                            <option>Review</option>
                            <option>Immunization</option>
                            <option>Lab</option>
                            <option>Referral</option>
                          </select>
                          <select style={{ ...inputStyle, flex: 1 }} value={encounterDraft.facilityId} onChange={(e) => setEncounterDraft({ ...encounterDraft, facilityId: e.target.value })}>
                            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </div>
                        <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Diagnosis / problem" value={encounterDraft.diagnosis} onChange={(e) => setEncounterDraft({ ...encounterDraft, diagnosis: e.target.value })} />
                        <textarea style={{ ...inputStyle, marginBottom: 8, minHeight: 44, fontFamily: "inherit" }} placeholder="History" value={encounterDraft.history} onChange={(e) => setEncounterDraft({ ...encounterDraft, history: e.target.value })} />
                        <textarea style={{ ...inputStyle, marginBottom: 8, minHeight: 44, fontFamily: "inherit" }} placeholder="Examination" value={encounterDraft.examination} onChange={(e) => setEncounterDraft({ ...encounterDraft, examination: e.target.value })} />
                        <textarea style={{ ...inputStyle, marginBottom: 8, minHeight: 44, fontFamily: "inherit" }} placeholder="Comment / plan" value={encounterDraft.comment} onChange={(e) => setEncounterDraft({ ...encounterDraft, comment: e.target.value })} />
                        <button type="submit" disabled={savingEncounter} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                          {savingEncounter ? "Saving…" : "Save consultation"}
                        </button>
                      </form>

                      <div style={{ marginTop: 20 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Encounter history</div>
                        {encounters.length === 0 ? (
                          <div style={{ fontSize: 15, color: T.inkSoft }}>No encounters recorded yet.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {encounters.map((e) => (
                              <div key={e.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <div style={{ fontWeight: 600, fontSize: 15 }}>{e.diagnosis || e.encounter_type}</div>
                                  <div style={{ textAlign: "right", fontSize: 14, color: T.inkSoft }}>
                                    <div>{e.encounter_date}</div>
                                    <Badge tone="primary">{e.encounter_type}</Badge>
                                  </div>
                                </div>
                                <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 2 }}>{e.facilities?.name || "Unknown facility"}</div>
                                {e.history && <div style={{ fontSize: 14.5, marginTop: 6 }}><strong>History:</strong> {e.history}</div>}
                                {e.examination && <div style={{ fontSize: 14.5, marginTop: 3 }}><strong>Examination:</strong> {e.examination}</div>}
                                {e.comment && <div style={{ fontSize: 14.5, marginTop: 3 }}><strong>Comment:</strong> {e.comment}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {tab === "register" && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 2 }}>Register new patient — {stateName} instance</div>
            <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 18 }}>
              NIN is preferred but optional. Saved directly to the live database.
            </div>
            <form onSubmit={handleRegister}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Field label="First name">
                    <input style={inputStyle} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Chinedu" />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Middle name (optional)">
                    <input style={inputStyle} value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} placeholder="e.g. Obinna" />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Surname">
                    <input style={inputStyle} value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} placeholder="e.g. Eze" />
                  </Field>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Field label="NIN (optional)" hint="11 digits">
                    <input style={inputStyle} value={form.nin} onChange={(e) => setForm({ ...form, nin: e.target.value })} placeholder="12345678901" />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Date of birth">
                    <input type="date" style={inputStyle} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                  </Field>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Sex">
                    <select style={inputStyle} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                      <option>Female</option>
                      <option>Male</option>
                    </select>
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Phone">
                    <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0803 000 0000" />
                  </Field>
                </div>
              </div>
              <Field label="Street address">
                <input style={inputStyle} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              </Field>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Field label="LGA">
                    <input style={inputStyle} value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Registering facility">
                    <select style={inputStyle} value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
                      {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {formError && (
                <div style={{ background: T.dangerSoft, color: T.danger, padding: "9px 12px", borderRadius: 8, fontSize: 15, marginBottom: 14 }}>
                  {formError}
                </div>
              )}

              <button type="submit" disabled={saving} style={{
                background: T.primary, color: "#fff", border: "none", padding: "10px 18px",
                borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
              }}>
                {saving ? "Saving…" : "Register patient"}
              </button>
            </form>
          </div>
        )}

        {tab === "audit" && (
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 2 }}>Audit log</div>
            <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 16 }}>
              Every read or write against a patient record is logged — append-only at the database level.
              Entries flagged <Badge tone="danger">Break-glass</Badge> are accesses made without an existing
              care relationship to the patient, with the clinician's stated reason.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {audit.map((a) => (
                <div key={a.id} style={{ background: a.is_break_glass ? T.dangerSoft : T.surface, border: `1px solid ${a.is_break_glass ? T.danger : T.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      {a.action} — {a.patients?.full_name || "—"}
                      {a.is_break_glass && <Badge tone="danger">Break-glass</Badge>}
                    </div>
                    <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 2 }}>{a.app_users?.full_name || "Unknown"} · {a.justification || ""}</div>
                  </div>
                  <div style={{ fontSize: 14, color: T.inkSoft }}>{new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
              {audit.length === 0 && <div style={{ fontSize: 15, color: T.inkSoft }}>No activity yet.</div>}
            </div>
          </div>
        )}

        {tab === "protection" && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 2 }}>Data protection</div>
            <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 18 }}>
              This system holds sensitive personal information (names, NIN, addresses, health records). Below is what actually
              enforces protection — and two live tests you can run against the real, live database right now, not a mockup.
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 10 }}>How this is enforced</div>
              <ul style={{ fontSize: 15, color: T.ink, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                <li><strong>State-based isolation at the database level.</strong> Row Level Security policies on Postgres mean a user from one state cannot read another state's patient data — even if the application code tried to request it. This isn't a UI restriction that could be bypassed; it's enforced by the database itself.</li>
                <li><strong>Role-based write access.</strong> Only clinicians and admins can write clinical data (encounters, medications, allergies, problems); front desk and records officers are limited to registration and consent-type actions.</li>
                <li><strong>Append-only audit log.</strong> Every read and write against a patient record is logged, and a database trigger blocks any attempt to alter or delete an existing audit entry — proven below.</li>
                <li><strong>Encrypted in transit.</strong> All traffic runs over HTTPS/TLS.</li>
                <li><strong>Authenticated access only.</strong> No patient data is readable without signing in; unauthenticated requests are rejected by the database.</li>
              </ul>
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>Live test 1 — Cross-state isolation</div>
              <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 10 }}>
                Runs two real queries as your current, authenticated session: one with no state filter at all, and one explicitly
                requesting another state's patients by ID.
              </div>
              <button onClick={runIsolationTest} disabled={isolationRunning} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                {isolationRunning ? "Running…" : "Run isolation test"}
              </button>
              {isolationResult && (
                <div style={{ marginTop: 12, background: isolationResult.ok ? T.primarySoft : T.dangerSoft, borderRadius: 8, padding: "10px 12px", fontSize: 15 }}>
                  {isolationResult.ok ? (
                    <>
                      <div>Unfiltered query returned <strong>{isolationResult.ownStateCount}</strong> patient(s) — all from {stateName}.</div>
                      <div>Rows belonging to a different state in that unfiltered result: <strong>{isolationResult.leakedRows}</strong>.</div>
                      <div>Explicit request for {isolationResult.otherStateName}'s patients returned: <strong>{isolationResult.explicitAttemptRows}</strong> row(s).</div>
                      <div style={{ marginTop: 6, fontWeight: 700, color: T.primaryDark }}>
                        {isolationResult.leakedRows === 0 && isolationResult.explicitAttemptRows === 0
                          ? "✅ Cross-state access blocked by Row Level Security."
                          : "⚠ Unexpected: cross-state data was returned. This needs investigation."}
                      </div>
                    </>
                  ) : (
                    <div>Test could not run: {isolationResult.message}</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>Live test 2 — Audit log tamper resistance</div>
              <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 10 }}>
                Attempts to alter the most recent real audit log entry using your own authenticated session. This should fail —
                a database trigger blocks it, regardless of who's asking.
              </div>
              <button onClick={runAuditTamperTest} disabled={tamperRunning} style={{ background: T.danger, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                {tamperRunning ? "Running…" : "Attempt to alter audit log"}
              </button>
              {tamperResult && (
                <div style={{ marginTop: 12, background: tamperResult.ok ? T.primarySoft : T.dangerSoft, borderRadius: 8, padding: "10px 12px", fontSize: 15 }}>
                  {tamperResult.ok ? (
                    <>
                      <div style={{ fontWeight: 700, color: T.primaryDark, marginBottom: 4 }}>✅ Blocked, as expected.</div>
                      <div style={{ fontFamily: "monospace", fontSize: 14 }}>{tamperResult.message}</div>
                    </>
                  ) : (
                    <div>{tamperResult.message}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "programmes" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>Reminders</div>
            <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 18 }}>
              Shown on the sign-in screen for {stateName} — only staff ever see this page, since there's no
              public/patient portal, so use it for things your teams need to know: campaign rollouts, training
              deadlines, protocol changes, compliance reminders. Keep it current.
            </div>

            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>New reminder</div>
              <form onSubmit={handleAddProgramme}>
                <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Title, e.g. Flu vaccine stock arrives Monday — confirm cold-chain storage" value={programmeDraft.title} onChange={(e) => setProgrammeDraft({ ...programmeDraft, title: e.target.value })} />
                <textarea style={{ ...inputStyle, marginBottom: 8, minHeight: 60, fontFamily: "inherit" }} placeholder="Description" value={programmeDraft.description} onChange={(e) => setProgrammeDraft({ ...programmeDraft, description: e.target.value })} />
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input type="date" style={inputStyle} value={programmeDraft.startDate} onChange={(e) => setProgrammeDraft({ ...programmeDraft, startDate: e.target.value })} />
                  <input type="date" style={inputStyle} value={programmeDraft.endDate} onChange={(e) => setProgrammeDraft({ ...programmeDraft, endDate: e.target.value })} />
                </div>
                <button type="submit" disabled={savingProgramme} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                  {savingProgramme ? "Saving…" : "Publish"}
                </button>
              </form>
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Current entries</div>
            {programmes.length === 0 ? (
              <div style={{ fontSize: 15, color: T.inkSoft }}>Nothing published yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {programmes.map((p) => (
                  <div key={p.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{p.title}</div>
                      <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 2 }}>{p.description}</div>
                      {(p.start_date || p.end_date) && (
                        <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
                          {p.start_date || "—"} to {p.end_date || "ongoing"}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <Badge tone={p.is_active ? "primary" : "amber"}>{p.is_active ? "Live" : "Hidden"}</Badge>
                      <button onClick={() => handleToggleProgramme(p.id, p.is_active)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 13, color: T.inkSoft, cursor: "pointer" }}>
                        {p.is_active ? "Hide" : "Publish"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "users" && (
          <div style={{ maxWidth: 780 }}>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 2 }}>Staff accounts — {stateName}</div>
            <div style={{ fontSize: 14.5, color: T.inkSoft, marginBottom: 18 }}>
              Change a staff member's role, or deactivate an account — a deactivated account loses all
              access immediately, not just its visibility here.
            </div>
            {staffAccounts.length === 0 ? (
              <div style={{ fontSize: 15, color: T.inkSoft }}>No staff accounts found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {staffAccounts.map((u) => (
                  <div key={u.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, opacity: u.is_active ? 1 : 0.6 }}>
                    <div>
                      <div style={{ fontSize: 15.5, fontWeight: 600 }}>
                        {u.full_name}{u.id === profile.id && <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 400 }}> (you)</span>}
                      </div>
                      <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 2 }}>
                        {u.email || "—"}{u.license_number ? ` · ${u.license_number}` : ""}{u.facilities?.name ? ` · ${u.facilities.name}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {!u.is_active && <Badge tone="amber">Deactivated</Badge>}
                      <select
                        style={{ ...inputStyle, width: 150 }}
                        value={u.role}
                        disabled={staffUpdating[u.id]}
                        onChange={(e) => handleChangeStaffRole(u.id, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <button
                        onClick={() => handleToggleStaffActive(u.id, u.is_active)}
                        disabled={staffUpdating[u.id]}
                        style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 14, color: u.is_active ? T.danger : T.primary, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
