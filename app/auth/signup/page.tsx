"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "";

function SignupForm() {
  const params = useSearchParams();
  const router = useRouter();
  const deviceId = params.get("deviceId") ?? "";
  const returnTo = params.get("returnTo") ?? (deviceId ? "/auth/desktop" : "/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(`${CP_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.message ?? "Registration failed.");
        return;
      }
      setStatus("success");
      setMessage("Account created. Redirecting…");
      const returnUrl = new URL(returnTo, window.location.origin);
      if (deviceId) returnUrl.searchParams.set("deviceId", deviceId);
      setTimeout(() => router.push(returnUrl.pathname + returnUrl.search), 800);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "Network error.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="card" style={{ maxWidth: 440, width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Create your account</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
          Sign up to use JoinCloud and manage your devices and plans.
        </p>

        {deviceId && (
          <div style={{ background: "var(--surface-elevated)", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 13, color: "var(--muted)" }}>
            Linking device: <span style={{ fontFamily: "monospace", color: "var(--foreground)" }}>{deviceId.slice(0, 16)}…</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading" || status === "success"}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "loading" || status === "success"}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={status === "loading" || status === "success"}
              placeholder="••••••••"
            />
          </div>

          {message && (
            <p style={{ fontSize: 14, color: status === "error" ? "#ef4444" : "#22c55e", margin: 0 }}>{message}</p>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={status === "loading" || status === "success"}
          >
            {status === "loading" ? "Creating account…" : status === "success" ? "Redirecting…" : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
          Already have an account?{" "}
          <a href={deviceId ? `/auth/desktop?deviceId=${encodeURIComponent(deviceId)}` : "/auth/desktop"} style={{ color: "var(--primary)", textDecoration: "none" }}>
            Sign in
          </a>
          {" · "}
          <a href="/billing" style={{ color: "var(--primary)", textDecoration: "none" }}>View plans</a>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "var(--muted)" }}>Loading…</p></main>}>
      <SignupForm />
    </Suspense>
  );
}
