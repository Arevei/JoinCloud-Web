"use client";

import Link from "next/link";
import Header from "@/components/Header";

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Change Password</h1>
          <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginBottom: 24 }}>
            Open your Account Dashboard from the JoinCloud desktop app and click &quot;Change Password&quot; in the Account section.
          </p>
          <Link href="/auth/desktop" className="btn btn-secondary" style={{ textDecoration: "none", display: "inline-block", padding: "10px 20px" }}>
            Back to Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
