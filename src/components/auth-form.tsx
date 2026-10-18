"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

const schemas = {
  login: z.object({ email: z.email("Enter a valid email address."), password: z.string().min(8, "Password must contain at least 8 characters.") }),
  register: z.object({ displayName: z.string().trim().max(80, "Name must be 80 characters or fewer."), email: z.email("Enter a valid email address."), password: z.string().min(8, "Use at least 8 characters."), confirm: z.string() }).refine((value) => value.password === value.confirm, { message: "Passwords do not match.", path: ["confirm"] }),
  forgot: z.object({ email: z.email("Enter a valid email address.") }),
  reset: z.object({ password: z.string().min(8, "Use at least 8 characters."), confirm: z.string() }).refine((value) => value.password === value.confirm, { message: "Passwords do not match.", path: ["confirm"] })
};
type Mode = keyof typeof schemas;
type Fields = { email?: string; password?: string; confirm?: string; displayName?: string };
const copy: Record<Mode, { title: string; description: string; submit: string }> = {
  login: { title: "Welcome back", description: "Sign in to continue to your workspace.", submit: "Sign in" },
  register: { title: "Create your account", description: "Set up a private workspace for your review data.", submit: "Create account" },
  forgot: { title: "Reset your password", description: "We’ll email you a secure link to choose a new password.", submit: "Send reset link" },
  reset: { title: "Choose a new password", description: "Use at least 8 characters for your new password.", submit: "Update password" }
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<Fields>({ resolver: zodResolver(schemas[mode]) as Resolver<Fields>, defaultValues: { displayName: "", email: "", password: "", confirm: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: values.email!, password: values.password! });
        if (error) throw error;
        router.replace("/dashboard"); router.refresh();
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email: values.email!, password: values.password!, options: { data: { display_name: values.displayName ?? "" }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` } });
        if (error) throw error;
        if (data.session) { router.replace("/dashboard"); router.refresh(); }
        else setMessage("Account created. Check your email for the confirmation link before signing in.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email!, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
        if (error) throw error;
        setMessage("If an account exists for that email, a secure reset link is on its way.");
      } else {
        const { error } = await supabase.auth.updateUser({ password: values.password! });
        if (error) throw error;
        toast.success("Password updated."); router.replace("/dashboard"); router.refresh();
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Authentication could not be completed."); }
    finally { setBusy(false); }
  });

  const fieldError = (name: keyof Fields) => errors[name] && <span className="form-error" role="alert">{errors[name]?.message}</span>;
  return <div className="auth-card">
    <h2>{copy[mode].title}</h2><p>{copy[mode].description}</p>
    <form onSubmit={onSubmit} noValidate>
      {mode === "register" && <div className="field"><label htmlFor="displayName">Display name</label><input className="input" id="displayName" autoComplete="name" {...register("displayName")} />{fieldError("displayName")}</div>}
      {mode !== "reset" && <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" type="email" autoComplete="email" {...register("email")} />{fieldError("email")}</div>}
      {(mode === "login" || mode === "register" || mode === "reset") && <div className="field"><label htmlFor="password">{mode === "login" ? "Password" : "New password"}</label><input className="input" id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} {...register("password")} />{fieldError("password")}</div>}
      {(mode === "register" || mode === "reset") && <div className="field"><label htmlFor="confirm">Confirm password</label><input className="input" id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />{fieldError("confirm")}</div>}
      {mode === "login" && <div style={{ textAlign: "right", marginTop: -4, fontSize: 11 }}><Link className="text-link" href="/forgot-password">Forgot password?</Link></div>}
      {message && <div className="notice" role="status" style={{ margin: "14px 0" }}>{message}</div>}
      <Button type="submit" disabled={busy} style={{ width: "100%", marginTop: 16 }}>{busy ? "Please wait…" : copy[mode].submit}</Button>
    </form>
    <div className="auth-bottom">{mode === "login" ? <>New to ReviewLens? <Link href="/register">Create an account</Link></> : mode === "register" ? <>Already have an account? <Link href="/login">Sign in</Link></> : <Link href="/login">Back to sign in</Link>}</div>
  </div>;
}
