# NaijaHealth Record — EHR Web App

A working web application with a real Supabase backend: authentication,
persistent PostgreSQL storage, row-level security enforcing per-state
tenant isolation and role-based access, and an append-only audit log.

## Run locally

```
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

The `.env` file already contains this project's live Supabase credentials
(the public anon/publishable key — safe to expose in a frontend by design,
since row-level security enforces all real access control server-side).

## First use

1. On the sign-in screen, click "Create one" to sign up.
2. Pick a role (front desk, clinician, pharmacist, records officer, admin)
   and a state — this determines which state's patient records you can
   see and what actions you're allowed to take (enforced by database-level
   RLS, not just hidden in the UI).
3. Depending on this Supabase project's auth settings, you may need to
   confirm your email before signing in for the first time.
4. Register a patient, search, view the record, and check the audit log —
   this is real, persistent data in Postgres, not in-memory mock data.

## What's real here vs. what's still a placeholder

**Real:** authentication, database, RLS-enforced state/role access
control, patient registration and search, encounter viewing, append-only
audit logging (verified directly against the database — a raw SQL UPDATE
or DELETE against the audit log is rejected by a trigger, not just
blocked in the UI).

**Still placeholder / not yet built:** actual NIN verification against
NIMC (the NIN field is currently just format-validated — 11 digits — not
checked against a real identity registry, since that requires a formal
data-sharing agreement this project doesn't have); clinician workflows
for adding new encounters/observations/prescriptions from the UI
(currently only seeded via SQL, not a form); consent management UI;
and offline support for low-connectivity clinics. These map to later
phases in the architecture and state-adoption-playbook documents.

## Test accounts

None are pre-created — sign up to create the first one. Seed data
includes 10 state instances (Lagos, Kano, Kaduna, Rivers, Oyo, FCT,
Enugu, Delta, Anambra, Ogun) and a handful of demo facilities in Lagos,
Kaduna, and Kano.
