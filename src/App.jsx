import React from "react";
import { useAuth } from "./useAuth";
import AuthScreen from "./AuthScreen";
import CompleteProfile from "./CompleteProfile";
import EhrApp from "./EhrApp";

export default function App() {
  const { session, profile, loading, signIn, signUp, signOut, completeProfile, refreshProfile } = useAuth();

  if (loading) {
    return <div style={{ padding: 40, fontFamily: "sans-serif", color: "#5B6B65" }}>Loading…</div>;
  }

  if (!session) {
    return <AuthScreen signIn={signIn} signUp={signUp} />;
  }

  if (!profile) {
    return <CompleteProfile completeProfile={completeProfile} signOut={signOut} />;
  }

  return <EhrApp profile={profile} signOut={signOut} refreshProfile={refreshProfile} />;
}
