"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";

const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "";

interface SummaryAccount {
  id: string;
  email: string | null;
  username?: string | null;
  isDeviceOnly?: boolean;
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
    members: { accountId: string; email: string; role?: string }[];
  };
}

interface SummarySubscription {
  status?: string;
  renewal_at?: string;
  plan_interval?: string;
  grace_ends_at?: string;
}

interface SummaryDevice {
  deviceId: string;
  displayName: string;
  platform: string;
  lastSeen: string | null;
}

interface AccountSummary {
  account: SummaryAccount | null;
  license: SummaryLicense;
  subscription?: SummarySubscription;
  device?: SummaryDevice;
}

function statusBadge(status: string | null | undefined, tier?: string) {
  const s = status ?? "none";
  const paidTiers = ["pro", "teams", "custom"];
  const isPaidPlan = tier && paidTiers.includes(tier.toLowerCase());
  const displayStatus = isPaidPlan && (s === "trial_active" || s === "trialing") ? "active" : s;
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
    <span className={`badge ${cls[displayStatus] ?? "badge-none"}`}>
      {displayStatus.replace(/_/g, " ")}
    </span>
  );
}

function formatDate(d: string | number | null | undefined) {
  if (!d) return "-";
  const date = typeof d === "number" ? new Date(d * 1000) : new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeTime(iso: string | null | undefined) {
  if (!iso) return "-";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(iso);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--stroke)" }}>
      <span style={{ color: "var(--foreground-soft)", fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}

function DashboardContent() {
  const params = useSearchParams();
  const accountId = params.get("accountId") ?? params.get("account_id") ?? "";
  const deviceId = params.get("deviceId") ?? params.get("device_id") ?? "";

  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetCurrentPassword, setResetCurrentPassword] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
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
        const q = new URLSearchParams();
        if (deviceId) q.set("host_uuid", deviceId);
        if (accountId) q.set("account_id", accountId);
        const res = await fetch(`${CP_URL}/api/v1/account/summary?${q.toString()}`);
        if (res.status === 404) {
          setError("No license found for this device or account.");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError("Could not load dashboard. Start the Control Plane (JoinCloudAdmin) with: cd JoinCloudAdmin && npm run dev - it runs on port 5000.");
          setLoading(false);
          return;
        }
        const data: AccountSummary = await res.json();
        setSummary(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Network error. Is the Control Plane (JoinCloudAdmin) running? Start it with: cd JoinCloudAdmin && npm run dev");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [accountId, deviceId]);

  async function refreshSummary() {
    if (!accountId && !deviceId) return;
    const q = new URLSearchParams();
    if (deviceId) q.set("host_uuid", deviceId);
    if (accountId) q.set("account_id", accountId);
    const res = await fetch(`${CP_URL}/api/v1/account/summary?${q.toString()}`);
    if (res.ok) {
      const data: AccountSummary = await res.json();
      setSummary(data);
    }
  }

  async function handlePasswordReset() {
    setResetError("");
    const email = summary?.account?.email;
    if (!email) {
      setResetError("No account email.");
      return;
    }
    if (resetNewPassword.length < 8) {
      setResetError("New password must be at least 8 characters.");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("New passwords do not match.");
      return;
    }
    setResetSaving(true);
    try {
      const res = await fetch(`${CP_URL}/api/v1/account/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          currentPassword: resetCurrentPassword,
          newPassword: resetNewPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetError(data.message || "Failed to change password.");
        return;
      }
      setResetSuccess(true);
      setResetCurrentPassword("");
      setResetNewPassword("");
      setResetConfirmPassword("");
      setTimeout(() => {
        setResetModalOpen(false);
        setResetSuccess(false);
      }, 1500);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "Network error");
    } finally {
      setResetSaving(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setTeamActionError("");
    const primaryEmail = summary?.account?.email ?? summary?.license?.members?.primary?.email ?? "";
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
    } catch (err: unknown) {
      setTeamActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTeamActionLoading(false);
    }
  }

  async function handleRemoveMember(memberEmail: string) {
    setTeamActionError("");
    const primaryEmail = summary?.account?.email ?? summary?.license?.members?.primary?.email ?? "";
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
    } catch (err: unknown) {
      setTeamActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTeamActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--foreground-soft)" }}>Loading dashboard…</p>
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
  const device = summary?.device;
  const isDeviceOnly = account?.isDeviceOnly ?? false;
  const isTeams = license?.tier === "teams";
  const teamMembers = license?.members?.members ?? [];
  const primaryEmail = (license?.members?.primary?.email ?? account?.email) ?? "";

  const plan = (license?.tier ?? "trial").replace(/^./, (c: string) => c.toUpperCase());
  const status = subscription?.status ?? license?.state ?? "none";
  const paidTiers = ["pro", "teams", "custom"];
  const isPaidTier = license?.tier && paidTiers.includes(license.tier.toLowerCase());
  const hasActivePaidPlan = isPaidTier || status === "active" || status === "trialing";
  const planButtonText = hasActivePaidPlan ? "Change Plan" : "Upgrade Plan";
  const billingUrl = `/billing?accountId=${encodeURIComponent(accountId || account?.id || "")}${deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""}`;

  const signInUrl = deviceId ? `/auth/desktop?deviceId=${encodeURIComponent(deviceId)}` : "/auth/desktop";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1, padding: "48px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: "var(--foreground)" }}>Account Dashboard</h1>
        <p style={{ color: "var(--foreground-soft)", marginBottom: 32, fontSize: 14 }}>
          {!isDeviceOnly && account?.email ? account.email : isDeviceOnly ? "Device not linked to an account" : "-"}
        </p>

        {/* SECTION 1 - Account (only for real accounts) */}
        {!isDeviceOnly ? (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: "var(--foreground)" }}>Account</h2>
            <Row label="Email" value={account?.email ?? "-"} />
            <Row label="Password" value={<span style={{ color: "var(--foreground-soft)" }}>********</span>} />
            <div style={{ paddingTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 14, padding: "8px 16px" }}
                onClick={() => { setResetModalOpen(true); setResetError(""); setResetSuccess(false); }}
              >
                Change Password
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: "var(--foreground)" }}>Account</h2>
            <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginBottom: 16 }}>
              This device is not linked to an account. Sign in from the JoinCloud desktop app to link it and see your email here.
            </p>
            <a href={signInUrl} className="btn btn-primary" style={{ textDecoration: "none", fontSize: 14, padding: "8px 16px", display: "inline-block" }}>
              Sign in to link account
            </a>
          </div>
        )}

        {/* SECTION 2 - Subscription */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: "var(--foreground)" }}>Subscription</h2>
          <Row label="Plan" value={plan} />
          <Row label="Status" value={statusBadge(status, license?.tier)} />
          {license?.expires_at != null && (status === "trial_active" || status === "trialing") && (
            <Row label="Trial Ends" value={formatDate(license.expires_at)} />
          )}
          {(subscription?.renewal_at && (status === "active" || status === "trialing")) && (
            <Row label="Renews" value={formatDate(subscription.renewal_at)} />
          )}
          {subscription?.grace_ends_at && (
            <Row label="Grace ends" value={<span style={{ color: "#f59e0b" }}>{formatDate(subscription.grace_ends_at)}</span>} />
          )}
          <div style={{ paddingTop: 16 }}>
            <a
              href={billingUrl}
              className="btn btn-primary"
              style={{ textDecoration: "none", fontSize: 14, padding: "8px 16px" }}
            >
              {planButtonText}
            </a>
          </div>
        </div>

        {/* SECTION 3 - Device Information */}
        {device && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: "var(--foreground)" }}>Device</h2>
            <Row label="Device Name" value={device.displayName} />
            <Row label="Device ID" value={<span style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{device.deviceId}</span>} />
            <Row label="Platform" value={device.platform || "-"} />
            <Row label="Last Active" value={formatRelativeTime(device.lastSeen)} />
          </div>
        )}

        {/* Team members (Teams plan only) */}
        {isTeams && !isDeviceOnly && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: "var(--foreground)" }}>Team members</h2>
            <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginBottom: 12 }}>
              Add or remove members from your team (primary: {primaryEmail || "-"}).
            </p>
            {teamActionError && (
              <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 12 }}>{teamActionError}</p>
            )}
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0", fontSize: 14 }}>
              {primaryEmail && (
                <li style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontWeight: 600 }}>{primaryEmail}</span>
                  <span style={{ color: "var(--foreground-soft)", marginLeft: 8 }}>(primary)</span>
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
                <label style={{ display: "block", fontSize: 12, color: "var(--foreground-soft)", marginBottom: 4 }}>New member email</label>
                <input
                  type="email"
                  value={teamMemberEmail}
                  onChange={(e) => setTeamMemberEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  style={{ width: 220, padding: "8px 10px", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--foreground-soft)", marginBottom: 4 }}>Your password</label>
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
      </div>

      {/* Change Password Modal */}
      {resetModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !resetSaving && setResetModalOpen(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 400, width: "90%", padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Change Password</h2>
            {resetSuccess ? (
              <p style={{ color: "#22c55e", fontSize: 14 }}>Password updated successfully.</p>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--foreground-soft)", marginBottom: 4 }}>Current password</label>
                  <input
                    type="password"
                    value={resetCurrentPassword}
                    onChange={(e) => setResetCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{ width: "100%", padding: "8px 12px", fontSize: 14 }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--foreground-soft)", marginBottom: 4 }}>New password (min 8 characters)</label>
                  <input
                    type="password"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={{ width: "100%", padding: "8px 12px", fontSize: 14 }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--foreground-soft)", marginBottom: 4 }}>Confirm new password</label>
                  <input
                    type="password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    style={{ width: "100%", padding: "8px 12px", fontSize: 14 }}
                  />
                </div>
                {resetError && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{resetError}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={handlePasswordReset}
                    disabled={resetSaving || !resetCurrentPassword || !resetNewPassword || !resetConfirmPassword}
                  >
                    {resetSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setResetModalOpen(false)}
                    disabled={resetSaving}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "var(--foreground-soft)" }}>Loading…</p></main>}>
      <DashboardContent />
    </Suspense>
  );
}
