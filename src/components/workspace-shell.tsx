"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, Boxes, ChartNoAxesCombined, FileClock, FileText, LayoutDashboard, LogOut, MessageSquareText, ScanSearch, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const primary = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Reviews", href: "/reviews", icon: MessageSquareText },
  { label: "Sentiment", href: "/sentiment", icon: ChartNoAxesCombined },
  { label: "Products", href: "/products", icon: Boxes }
];
const library = [
  { label: "Datasets", href: "/datasets", icon: BarChart3 },
  { label: "History", href: "/history", icon: FileClock },
  { label: "Reports", href: "/reports", icon: FileText }
];

export function WorkspaceShell({ children, email, displayName }: { children: React.ReactNode; email?: string; displayName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = pathname === "/dashboard" ? "Workspace" : pathname.split("/").filter(Boolean).at(-1)?.replace(/-/g, " ") ?? "Workspace";
  async function signOut() {
    setBusy(true);
    try { const { error } = await createClient().auth.signOut(); if (error) throw error; router.replace("/login"); router.refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Sign out failed."); }
    finally { setBusy(false); }
  }
  return <div className="workspace">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand sidebar-brand"><span className="brand-mark"><ScanSearch size={17} /></span>ReviewLens</Link>
      <div className="nav-label">Workspace</div><nav className="nav-list" aria-label="Workspace navigation">{primary.map((item) => <NavLink key={item.href} {...item} pathname={pathname} />)}</nav>
      <div className="nav-label">Your library</div><nav className="nav-list" aria-label="Library navigation">{library.map((item) => <NavLink key={item.href} {...item} pathname={pathname} />)}</nav>
      <div className="nav-label">Account</div><nav className="nav-list" aria-label="Account navigation"><NavLink label="Settings" href="/settings/profile" icon={Settings2} pathname={pathname} /></nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-user"><span className="avatar">{(displayName || email || "R").slice(0, 1).toUpperCase()}</span><div className="user-meta"><strong>{displayName || "Your workspace"}</strong><span>{email || "Signed in"}</span></div><button className="button button-ghost button-small" aria-label="Sign out" title="Sign out" disabled={busy} onClick={signOut}><LogOut size={15} /></button></div>
    </aside>
    <div className="workspace-main"><header className="topbar"><div className="breadcrumbs"><span>ReviewLens</span><span aria-hidden="true">/</span><span style={{ textTransform: "capitalize", color: "var(--ink)" }}>{label}</span></div><div className="topbar-right"><a className="developer-link" href="https://www.linkedin.com/in/shivamshukla-ds/" target="_blank" rel="noopener noreferrer" aria-label="Developed by Shivam Shukla; open LinkedIn profile">Developer: Shivam Shukla ↗</a><span>Private workspace</span><span aria-hidden="true">·</span><Link href="/settings/profile" className="text-link">Account settings</Link><button className="button button-ghost button-small mobile-signout" onClick={signOut} disabled={busy} aria-label="Sign out"><LogOut size={15}/></button></div></header><main className="workspace-content">{children}</main></div>
  </div>;
}

function NavLink({ label, href, icon: Icon, pathname }: { label: string; href: string; icon: typeof LayoutDashboard; pathname: string }) {
  const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <Link className={`nav-item${active ? " active" : ""}`} href={href} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.8} /><span>{label}</span></Link>;
}
