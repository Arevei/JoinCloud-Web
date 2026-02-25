"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "";

interface SummaryAccount {
  id: string;
  email: string | null;
}

interface LicenseMember {
  accountId: string;
  email: string;
  role?: string;
}

interface SummaryLicense {
  id: string;
  tier: string;
  device_limit: number;
  state: string;
  expires_at: number;
  grace_ends_at?: number;
  members?: {
    primary: { accountId: string; email: string } | null;
    members: LicenseMember[];
  };
}

interface SummarySubscription {
  status?: string;
  renewal_at?: string;
  plan_interval?: string;
  grace_ends_at?: string;
}

interface AccountSummary {
  account: SummaryAccount | null;
  license: SummaryLicense;
  subscription?: SummarySubscription;
}

function statusBadge(status: string | null | undefined) {
  const s = status ?? "none";
  const cls: Record<string, string> = {
    active: "badge-active",
    trialing: "badge-trial",
    trial_active: "badge-trial",
    grace: "badge-grace",
    past_due: "badge-grace",
    expired: "badge-expired",
    canceled: "badge-expired",
    none: "badge-none",
  };
  return (
    <span className={`badge ${cls[s] ?? "badge-none"}`}>
      {s.replace(/_/g, " ")}
    </span>
  );
}

function formatDate(d: string | number | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "number" ? new Date(d * 1000) : new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DashboardContent() {
  const params = useSearchParams();
  const accountId = params.get("accountId") ?? params.get("account_id") ?? "";
  const deviceId = params.get("deviceId") ?? params.get("device_id") ?? "";

  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [invoices, setInvoices] = useState<Array<{ id: string; created: number; amount_paid: number; currency: string; status: string; description?: string; hosted_invoice_url?: string | null; invoice_pdf?: string | null }>>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teamPassword, setTeamPassword] = useState("");
  const [teamMemberEmail, setTeamMemberEmail] = useState("");
  const [teamActionLoading, setTeamActionLoading] = useState(false);
  const [teamActionError, setTeamActionError] = useState("");
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [removePassword, setRemovePassword] = useState("");

  useEffect(() => {
    if (!accountId && !deviceId) {
      setError("Open this page from the JoinCloud desktop app (Billing → Open Dashboard on Web).");
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const params = new URLSearchParams();
        if (deviceId) params.set("host_uuid", deviceId);
        if (accountId) params.set("account_id", accountId);
        const res = await fetch(`${CP_URL}/api/v1/account/summary?${params.toString()}`);
        if (res.status === 404) {
          setError("No license found for this device or account.");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError("Could not load dashboard. Ensure NEXT_PUBLIC_CONTROL_PLANE_URL is set and the Control Plane is running.");
          setLoading(false);
          return;
        }
        const data: AccountSummary = await res.json();
        setSummary(data);
      } catch (err: any) {
        setError(err?.message ?? "Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [accountId, deviceId]);

  useEffect(() => {
    if (!CP_URL || (!deviceId && !accountId)) return;
    let cancelled = false;
    setInvoicesLoading(true);
    const params = new URLSearchParams();
    if (deviceId) params.set("host_uuid", deviceId);
    if (accountId) params.set("account_id", accountId);
    fetch(`${CP_URL}/api/v1/billing/invoices?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        if (!cancelled) setInvoices(Array.isArray(list) ? list : []);
      })
      .catch(() => { if (!cancelled) setInvoices([]); })
      .finally(() => { if (!cancelled) setInvoicesLoading(false); });
    return () => { cancelled = true; };
  }, [CP_URL, deviceId, accountId]);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted)" }}>Loading dashboard…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 480, width: "100%" }}>
          <p style={{ color: "#ef4444" }}>{error}</p>
        </div>
      </main>
    );
  }

  const account = summary?.account ?? null;
  const license = summary?.license;
  const subscription = summary?.subscription;
  const displayId = accountId || deviceId;
  const isTeams = license?.tier === "teams";
  const teamMembers = license?.members?.members ?? [];
  const primaryEmail = (license?.members?.primary?.email ?? account?.email) ?? "";

  async function refreshSummary() {
    if (!accountId && !deviceId) return;
    const params = new URLSearchParams();
    if (deviceId) params.set("host_uuid", deviceId);
    if (accountId) params.set("account_id", accountId);
    const res = await fetch(`${CP_URL}/api/v1/account/summary?${params.toString()}`);
    if (res.ok) {
      const data: AccountSummary = await res.json();
      setSummary(data);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setTeamActionError("");
    if (!primaryEmail || !teamPassword.trim() || !teamMemberEmail.trim()) {
      setTeamActionError("Enter your password and the new member's email.");
      return;
    }
    setTeamActionLoading(true);
    try {
      const res = await fetch(`${CP_URL}/api/v1/teams/add-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_email: primaryEmail,
          password: teamPassword,
          member_email: teamMemberEmail.trim().toLowerCase(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTeamActionError(data.message || "Failed to add member.");
        return;
      }
      setTeamMemberEmail("");
      setTeamPassword("");
      setTeamActionError("");
      await refreshSummary();
    } catch (err: any) {
      setTeamActionError(err?.message ?? "Network error");
    } finally {
      setTeamActionLoading(false);
    }
  }

  async function handleRemoveMember(memberEmail: string) {
    setTeamActionError("");
    if (!primaryEmail || !removePassword.trim()) {
      setTeamActionError("Enter your password to confirm removal.");
      return;
    }
    setTeamActionLoading(true);
    try {
      const res = await fetch(`${CP_URL}/api/v1/teams/remove-member`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_email: primaryEmail,
          password: removePassword,
          member_email: memberEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTeamActionError(data.message || "Failed to remove member.");
        return;
      }
      setRemovingEmail(null);
      setRemovePassword("");
      setTeamActionError("");
      await refreshSummary();
    } catch (err: any) {
      setTeamActionError(err?.message ?? "Network error");
    } finally {
      setTeamActionLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Account Dashboard</h1>
        <p style={{ color: "var(--muted)", marginBottom: 32 }}>
          {account?.email ?? (displayId ? `${displayId.slice(0, 16)}…` : "—")}
        </p>

        {/* Subscription summary */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Subscription</h2>
          <Row label="Status" value={statusBadge(subscription?.status ?? license?.state)} />
          <Row label="Plan" value={(license?.tier ?? "trial").replace(/^./, (c: string) => c.toUpperCase())} />
          <Row label="Device limit" value={license?.device_limit?.toString() ?? "5"} />
          <Row label="Renewal" value={formatDate(subscription?.renewal_at)} />
          {subscription?.grace_ends_at && (
            <Row label="Grace ends" value={<span style={{ color: "#f59e0b" }}>{formatDate(subscription.grace_ends_at)}</span>} />
          )}
          {license?.expires_at != null && (
            <Row label="License expires" value={formatDate(license.expires_at)} />
          )}
        </div>

        {/* Payment / Upgrade */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Payment</h2>
          <div style={{ marginBottom: 16 }}>
            <a
              href={`/billing?accountId=${encodeURIComponent(accountId || displayId)}${deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""}`}
              className="btn btn-primary"
              style={{ textDecoration: "none", fontSize: 14, padding: "8px 16px" }}
            >
              Upgrade / Change plan
            </a>
          </div>
        </div>

        {/* Add a device */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Add a device</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 12 }}>
            Link another computer or device to this account (within your plan&apos;s device limit):
          </p>
          <ol style={{ color: "var(--muted)", fontSize: 14, paddingLeft: 20, marginBottom: 16 }}>
            <li style={{ marginBottom: 6 }}>Open JoinCloud on the device you want to add.</li>
            <li style={{ marginBottom: 6 }}>In the app, choose &quot;Sign in with JoinCloud&quot; or &quot;Link this device&quot;.</li>
            <li>Your browser will open — sign in with this account to link the device.</li>
          </ol>
          <a
            href="/auth/desktop"
            className="btn btn-secondary"
            style={{ textDecoration: "none", fontSize: 14, padding: "8px 16px", display: "inline-block" }}
          >
            Open link-device page
          </a>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
            The link-device page will prompt for sign-in when the desktop app sends you there with a device code.
          </p>
        </div>

        {/* Team members (Teams plan only) */}
        {isTeams && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Team members</h2>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 12 }}>
              Add or remove members from your team (primary: {primaryEmail || "—"}).
            </p>
            {teamActionError && (
              <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 12 }}>{teamActionError}</p>
            )}
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0", fontSize: 14 }}>
              {primaryEmail && (
                <li style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontWeight: 600 }}>{primaryEmail}</span>
                  <span style={{ color: "var(--muted)", marginLeft: 8 }}>(primary)</span>
                </li>
              )}
              {teamMembers.map((m) => (
                <li key={m.accountId} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{m.email}</span>
                  {removingEmail === m.email ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="password"
                        placeholder="Your password"
                        value={removePassword}
                        onChange={(e) => setRemovePassword(e.target.value)}
                        style={{ width: 140, padding: "4px 8px", fontSize: 13 }}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => handleRemoveMember(m.email)}
                        disabled={teamActionLoading || !removePassword.trim()}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => { setRemovingEmail(null); setRemovePassword(""); setTeamActionError(""); }}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => setRemovingEmail(m.email)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form onSubmit={handleAddMember} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>New member email</label>
                <input
                  type="email"
                  value={teamMemberEmail}
                  onChange={(e) => setTeamMemberEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  style={{ width: 220, padding: "8px 10px", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Your password</label>
                <input
                  type="password"
                  value={teamPassword}
                  onChange={(e) => setTeamPassword(e.target.value)}
                  placeholder="To confirm"
                  style={{ width: 160, padding: "8px 10px", fontSize: 14 }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: 14, padding: "8px 16px" }}
                disabled={teamActionLoading}
              >
                {teamActionLoading ? "Adding…" : "Add member"}
              </button>
            </form>
          </div>
        )}

        {/* Past payments */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Past payments</h2>
          {invoicesLoading ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
          ) : invoices.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>No payments yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "8px 0", color: "var(--muted)" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "8px 0", color: "var(--muted)" }}>Description</th>
                  <th style={{ textAlign: "left", padding: "8px 0", color: "var(--muted)" }}>Amount</th>
                  <th style={{ textAlign: "left", padding: "8px 0", color: "var(--muted)" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "8px 0", color: "var(--muted)" }}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const created = typeof inv.created === "number" ? new Date(inv.created * 1000) : new Date(inv.created);
                  const dateStr = created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  const amount = (inv.amount_paid != null ? inv.amount_paid / 100 : 0).toFixed(2);
                  const currency = (inv.currency || "USD").toUpperCase();
                  const url = inv.hosted_invoice_url || inv.invoice_pdf;
                  return (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 0" }}>{dateStr}</td>
                      <td style={{ padding: "8px 0" }}>{inv.description ?? "Invoice"}</td>
                      <td style={{ padding: "8px 0" }}>{currency} {amount}</td>
                      <td style={{ padding: "8px 0" }}>{(inv.status ?? "—").replace(/_/g, " ")}</td>
                      <td style={{ padding: "8px 0" }}>{url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>View</a> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Account info */}
        <div className="card">
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Account</h2>
          <Row label="Account / Device ID" value={<span style={{ fontFamily: "monospace", fontSize: 13 }}>{displayId.slice(0, 24)}{displayId.length > 24 ? "…" : ""}</span>} />
          {account?.email && <Row label="Email" value={account.email} />}
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--muted)", fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 14 }}>{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "var(--muted)" }}>Loading…</p></main>}>
      <DashboardContent />
    </Suspense>
  );
}
