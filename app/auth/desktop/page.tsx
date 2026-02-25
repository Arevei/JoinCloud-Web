"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "";

function DesktopAuthForm() {
  const params = useSearchParams();
  const deviceId = params.get("deviceId") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [deepLinkFallback, setDeepLinkFallback] = useState("");

  const validDeviceId = deviceId && deviceId !== "host" && deviceId.length >= 8 && deviceId.length <= 128;

  useEffect(() => {
    if (!deviceId) {
      setStatus("error");
      setMessage("No device ID provided. Please click 'Sign In / Create Account' from the JoinCloud desktop app.");
    } else if (!validDeviceId) {
      setStatus("error");
      setMessage("Invalid device link. Please open JoinCloud on this computer and click Sign In from the app to open this page with a valid device ID.");
    }
  }, [deviceId, validDeviceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !validDeviceId) return;
    setStatus("loading");
    setMessage("");

    try {
      // Step 1: login to get JWT
      const loginRes = await fetch(`${CP_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok || !loginData.token) {
        setStatus("error");
        setMessage(loginData.message ?? "Invalid email or password.");
        return;
      }

      // Step 2: request one-time desktop auth token
      const tokenRes = await fetch(`${CP_URL}/api/v1/auth/desktop-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loginData.token}`,
        },
        body: JSON.stringify({ deviceId: deviceId!.trim() }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.token) {
        setStatus("error");
        setMessage(tokenData.message ?? "Could not generate desktop token.");
        return;
      }

      // Step 3: redirect browser to the deep link so Electron picks it up
      setStatus("success");
      setMessage("Redirecting to the JoinCloud desktop app…");
      const deepLink = `joincloud://auth?token=${encodeURIComponent(tokenData.token)}`;
      // Try immediate redirect; if the browser blocks it, user can click the link below
      window.location.href = deepLink;
      // Store for fallback link in case redirect is blocked (e.g. some browsers block custom protocols without a direct click)
      setDeepLinkFallback(deepLink);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "Network error. Check your connection.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="card" style={{ maxWidth: 440, width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Sign in to JoinCloud</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
          Signing in will link your account to the desktop app on this device.
        </p>

        {validDeviceId && deviceId && (
          <div style={{ background: "var(--surface-elevated)", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 13, color: "var(--muted)" }}>
            Device: <span style={{ fontFamily: "monospace", color: "var(--foreground)" }}>{deviceId.slice(0, 16)}…</span>
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "loading" || status === "success"}
              placeholder="••••••••"
            />
          </div>

          {message && (
            <p style={{ fontSize: 14, color: status === "error" ? "#ef4444" : "#22c55e", margin: 0 }}>
              {message}
            </p>
          )}

          {status === "success" && deepLinkFallback && (
            <p style={{ fontSize: 14, margin: 0 }}>
              If the app did not open,{" "}
              <a href={deepLinkFallback} style={{ color: "var(--primary)", fontWeight: 600 }}>
                click here to open JoinCloud
              </a>.
            </p>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={status === "loading" || status === "success" || !validDeviceId}
          >
            {status === "loading" ? "Signing in…" : "Sign in and open desktop app"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
          Don&apos;t have an account?{" "}
          <a href={validDeviceId && deviceId ? `/auth/signup?deviceId=${encodeURIComponent(deviceId)}` : "/auth/signup"} style={{ color: "var(--primary)", textDecoration: "none" }}>
            Sign up
          </a>
          {" · "}
          <a href="/billing" style={{ color: "var(--primary)", textDecoration: "none" }}>View plans</a>
        </p>
      </div>
    </main>
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "var(--muted)" }}>Loading…</p></main>}>
      <DesktopAuthForm />
    </Suspense>
  );
}
