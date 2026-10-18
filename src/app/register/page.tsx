import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";
import { AuthForm } from "@/components/auth-form";
export const metadata: Metadata = { title: "Create account" };
export default function RegisterPage() { return <AuthLayout><AuthForm mode="register" /></AuthLayout>; }
