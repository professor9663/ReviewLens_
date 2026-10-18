"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KeyRound, UserRound, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, PageHeading } from "@/components/ui";

type Profile = { display_name: string; created_at: string };
type Preferences = { theme: "light" | "dark" | "system"; default_export_format: "csv" | "xlsx" | "pdf" | "json" };
export function SettingsView({ section }: { section: "profile" | "security" | "preferences" }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({ theme: "light", default_export_format: "csv" });
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const titles = { profile: ["Profile settings", "Manage your display name and account information."], security: ["Security settings", "Review your sign-in status and request a password reset."], preferences: ["Preferences", "Set your theme and preferred export format."] } as const;
  useEffect(() => {
    Promise.all([apiFetch<{ profile: Profile; email: string; email_confirmed: boolean }>("/api/profile"), apiFetch<{ preferences: Preferences }>("/api/preferences")]).then(([profileData, preferenceData]) => {
      setProfile(profileData.profile); setName(profileData.profile?.display_name ?? ""); setEmail(profileData.email); setVerified(profileData.email_confirmed); if (preferenceData.preferences) setPreferences(preferenceData.preferences);
    }).catch((cause) => toast.error(cause.message));
  }, []);
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const result = await apiFetch<{ profile: Profile }>("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name }) }); setProfile(result.profile); toast.success("Profile saved."); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Profile could not be saved."); }
    finally { setBusy(false); }
  }
  async function savePreferences(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const result = await apiFetch<{ preferences: Preferences }>("/api/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preferences) }); setPreferences(result.preferences); document.documentElement.dataset.theme = result.preferences.theme; toast.success("Preferences saved."); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Preferences could not be saved."); }
    finally { setBusy(false); }
  }
  async function sendPasswordReset() {
    if (!email) return;
    setBusy(true);
    try { const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` }); if (error) throw error; toast.success("If the account is eligible, a password reset link has been sent."); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not send reset link."); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading title={titles[section][0]} description={titles[section][1]} />
    <nav className="settings-tabs" aria-label="Settings"><Link className={`settings-tab${section === "profile" ? " active" : ""}`} href="/settings/profile"><UserRound size={13}/> Profile</Link><Link className={`settings-tab${section === "security" ? " active" : ""}`} href="/settings/security"><KeyRound size={13}/> Security</Link><Link className={`settings-tab${section === "preferences" ? " active" : ""}`} href="/settings/preferences"><SlidersHorizontal size={13}/> Preferences</Link></nav>
    {section === "profile" && <Card className="card-pad form-shell"><form onSubmit={saveProfile}><div className="field"><label htmlFor="display-name">Display name</label><input id="display-name" className="input" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name"/><span className="field-hint">Shown in your workspace navigation.</span></div><div className="field"><label>Account email</label><input className="input" value={email} readOnly disabled/></div><Button type="submit" disabled={busy || !profile}>{busy ? "Saving…" : "Save profile"}</Button></form></Card>}
    {section === "preferences" && <Card className="card-pad form-shell"><form onSubmit={savePreferences}><div className="field"><label htmlFor="theme">Theme</label><select id="theme" className="select" value={preferences.theme} onChange={(event) => setPreferences({ ...preferences, theme: event.target.value as Preferences["theme"] })}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></select><span className="field-hint">The selected theme applies across the workspace.</span></div><div className="field"><label htmlFor="export-format">Default export format</label><select id="export-format" className="select" value={preferences.default_export_format} onChange={(event) => setPreferences({ ...preferences, default_export_format: event.target.value as Preferences["default_export_format"] })}><option value="csv">CSV</option><option value="xlsx">Excel workbook</option><option value="pdf">PDF report</option><option value="json">JSON</option></select></div><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save preferences"}</Button></form></Card>}
    {section === "security" && <div className="grid grid-2"><Card className="card-pad"><div className="section-head"><div><h2>Sign-in account</h2><p>Authentication is handled by Supabase Auth.</p></div></div><div className="field"><label>Email</label><input className="input" value={email} readOnly disabled/></div><div style={{ marginTop: 10 }}><span className={`badge ${verified ? "badge-positive" : "badge-neutral"}`}>{verified ? "Email confirmed" : "Email confirmation pending"}</span></div></Card><Card className="card-pad"><div className="section-head"><div><h2>Password</h2><p>Request a secure password reset link by email.</p></div></div><p style={{ color: "var(--ink-soft)", fontSize: 11, lineHeight: 1.65 }}>ReviewLens never stores passwords in application tables. Supabase Auth handles password storage and verification.</p><Button variant="secondary" onClick={sendPasswordReset} disabled={busy || !email}>{busy ? "Sending…" : "Send password reset link"}</Button></Card></div>}
  </>;
}
