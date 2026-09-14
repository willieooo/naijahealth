import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // ehr.app_users row
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from("app_users")
      .select("*, facilities:facility_id(name), state_instances:state_instance_id(state_name, insurance_scheme_name, phc_board_name)")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("Failed to load profile:", error.message);
      setProfile(null);
    } else {
      setProfile(data);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadProfile(session?.user?.id).finally(() => setLoading(false));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadProfile(session?.user?.id);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  async function signUp({ email, password, fullName, role, stateInstanceId, licenseNumber, facilityId }) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };
    const userId = data.user?.id;
    if (!userId) {
      return { error: { message: "Sign-up succeeded but no user id was returned." } };
    }
    // Important: if this project requires email confirmation, signUp() succeeds
    // but returns no session — the client is NOT authenticated yet, so any
    // insert attempt here would run as the anonymous role and be rejected by
    // the database (not a bug in the database, but in trying too early).
    // Skip the profile insert in that case; completeProfile() finishes it
    // after the user actually confirms and signs in.
    if (!data.session) {
      return { error: null, needsConfirmation: true };
    }
    const { error: profileError } = await supabase.from("app_users").insert({
      id: userId,
      full_name: fullName,
      role,
      state_instance_id: stateInstanceId,
      license_number: licenseNumber || null,
      facility_id: facilityId || null,
      email,
    });
    if (profileError) return { error: profileError };
    await loadProfile(userId);
    return { error: null };
  }

  // Called after a user signs in for the first time post-email-confirmation,
  // when they're authenticated but no app_users profile row exists yet.
  async function completeProfile({ fullName, role, stateInstanceId, licenseNumber, facilityId }) {
    if (!session?.user?.id) {
      return { error: { message: "You must be signed in to complete your profile." } };
    }
    const { error } = await supabase.from("app_users").insert({
      id: session.user.id,
      full_name: fullName,
      role,
      state_instance_id: stateInstanceId,
      license_number: licenseNumber || null,
      facility_id: facilityId || null,
      email: session.user.email,
    });
    if (error) return { error };
    await loadProfile(session.user.id);
    return { error: null };
  }

  async function signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, profile, loading, signUp, signIn, signOut, completeProfile, refreshProfile: () => loadProfile(session?.user?.id) };
}
