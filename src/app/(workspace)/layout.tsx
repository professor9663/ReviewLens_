import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { ThemeApplier } from "@/components/theme-applier";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  let user: { id: string; email?: string } | null = null;
  let displayName: string | undefined;
  let setupRequired = false;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      displayName = profile?.display_name;
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    setupRequired = true;
  }
  if (setupRequired) return <SetupRequired />;
  if (!user) redirect("/login");
  return <><ThemeApplier /><WorkspaceShell email={user.email} displayName={displayName}>{children}</WorkspaceShell></>;
}

function SetupRequired() { return <main className="legal-content"><Link href="/" className="brand"><span className="brand-mark">R</span>ReviewLens</Link><h1>Connect your Supabase project</h1><p>The workspace uses Supabase Auth and PostgreSQL. Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and anon key, apply the migrations, then refresh.</p><p><Link className="text-link" href="/">Return to the project overview</Link></p></main>; }
