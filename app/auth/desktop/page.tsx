"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Link from "next/link";

function DesktopAuthForm() {
  const params = useSearchParams();
  const deviceId = params.get("deviceId") ?? "";
  const accountId = params.get("accountId") ?? params.get("account_id") ?? "";
  const mode = params.get("mode") ?? "signin";

  const dashboardParams = new URLSearchParams();
  if (accountId) dashboardParams.set("accountId", accountId);
  if (deviceId) dashboardParams.set("deviceId", deviceId);
  const dashboardQuery = dashboardParams.toString();
  const dashboardHref = `/dashboard${dashboardQuery ? `?${dashboardQuery}` : ""}`;
  const billingHref = `/billing${dashboardQuery ? `?${dashboardQuery}` : ""}`;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div className="card" style={{ maxWidth: 440, width: "100%" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            JoinCloud desktop app
          </h1>
          <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            This page is used by the JoinCloud desktop app for linking your account. Sign-in via email is not required for the main flow.
          </p>
          <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            Open the dashboard from the app (Settings → Open Dashboard on Web) to manage your account, or use the links below.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link href={dashboardHref} className="btn btn-primary" style={{ textAlign: "center", textDecoration: "none" }}>
              Open Dashboard
            </Link>
            <Link href={billingHref} className="btn btn-secondary" style={{ textAlign: "center", textDecoration: "none" }}>
              Billing &amp; plans
            </Link>
          </div>
          {mode === "extendTrial" && (
            <p style={{ marginTop: 20, fontSize: 13, color: "var(--foreground-soft)" }}>
              To extend your trial, open JoinCloud on your device and use the Extend Trial link, or contact support.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "var(--foreground-soft)" }}>Loading…</p></main>}>
      <DesktopAuthForm />
    </Suspense>
  );
}
