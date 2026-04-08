"use client";

import { useState, Suspense, useEffect } from "react";
import Script from "next/script";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/Header";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "";
const BILLING_TOKEN_KEY = "joincloud_billing_token";

interface Plan {
  id: string;
  name: string;
  badge: string | null;
  description: string;
  priceMonthly: number;   // paise
  priceYearly: number;    // paise
  deviceLimit: number;
  features: string[];
  isCustom?: false;
}

interface CustomPlan {
  id: string;
  name: string;
  badge: string | null;
  description: string;
  isCustom: true;
  features: string[];
}

const PLANS: (Plan | CustomPlan)[] = [
  {
    id: "pro",
    name: "Pro",
    badge: "Most popular",
    description: "Single user, up to 3 devices",
    priceMonthly: 39900,    // ₹399/mo
    priceYearly: 399900,    // ₹3999/yr (~1 month free)
    deviceLimit: 3,
    features: [
      "3 devices",
      "50 shares/month",
      // "Up to 20 GB per file",
      // "Links up to 30 days",
      "Resumable downloads",
      "CDN cache (fast downloads)",
      // "Peer chat",
    ],
  },
  // {
  //   id: "pro_plus",
  //   name: "Pro+",
  //   badge: "Teams",
  //   description: "Up to 5 users, 5 devices each",
  //   priceMonthly: 99900,    // ₹999/mo
  //   priceYearly: 999900,    // ₹9999/yr
  //   deviceLimit: 25,
  //   features: [
  //     "5 users × 5 devices",
  //     "Unlimited shares",
  //     "Unlimited file size",
  //     "Links up to 90 days",
  //     "Resumable downloads",
  //     "CDN cache (fast downloads)",
  //     "Team spaces",
  //     "Peer chat",
  //   ],
  // },
  {
    id: "custom",
    name: "Custom",
    badge: null,
    description: "Enterprise — custom users/devices",
    isCustom: true,
    features: [
      // "Custom device & user limits",
      "Custom share limit",
      "Priority onboarding",
      "Dedicated support",
    ],
  },
];

const DESKTOP_BACKEND_URL = "http://127.0.0.1:8787";

function SuccessScreen({ successPlan, accountId, deviceId }: { successPlan: string; accountId: string; deviceId: string }) {
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [appRunning, setAppRunning] = useState<boolean | null>(null);

  useEffect(() => {
    if (!deviceId || !CP_URL) return;
    const token = typeof window !== "undefined" ? localStorage.getItem(BILLING_TOKEN_KEY) : null;
    if (!token) return;
    const checkAndFetch = async () => {
      try {
        await fetch(`${DESKTOP_BACKEND_URL}/api/v1/health`, { method: "GET", mode: "no-cors" });
        setAppRunning(true);
      } catch {
        setAppRunning(false);
      }
      const tokenRes = await fetch(`${CP_URL}/api/v1/auth/desktop-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deviceId }),
      });
      const d = await tokenRes.json();
      if (d.token) {
        setCallbackUrl(`${DESKTOP_BACKEND_URL}/auth/callback?token=${encodeURIComponent(d.token)}&mode=login`);
      }
    };
    checkAndFetch();
  }, [deviceId]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Plan activated!</h1>
        <p style={{ color: "var(--foreground-soft)", marginBottom: 20, fontSize: 14 }}>
          Your <strong>{successPlan}</strong> plan is now active.
        </p>
        {appRunning === false && (
          <p style={{ color: "#f59e0b", fontSize: 14, marginBottom: 16 }}>
            Please open JoinCloud on this computer first, then click the button below.
          </p>
        )}
        {callbackUrl ? (
          <>
            <a
              href={callbackUrl}
              className="btn btn-primary"
              style={{ display: "inline-block", padding: "12px 32px", textDecoration: "none" }}
            >
              Open JoinCloud Desktop
            </a>
            <p style={{ color: "var(--foreground-soft)", fontSize: 13, marginTop: 16 }}>
              {deviceId
                ? "The desktop app will detect your upgrade immediately. You can also close this window."
                : "Return to the desktop app to see your updated plan."}
            </p>
          </>
        ) : deviceId ? (
          <p style={{ color: "var(--foreground-soft)", fontSize: 13 }}>Preparing redirect…</p>
        ) : (
          <p style={{ color: "var(--foreground-soft)", fontSize: 13 }}>
            Your plan is active. Open JoinCloud on your computer to see the update.
          </p>
        )}
      </div>
    </main>
  );
}

function AuthScreen({ onSuccess, deviceId, devModePrompt }: { onSuccess: (accountId: string) => void; deviceId: string; devModePrompt?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    if (!CP_URL) {
      setMessage({ type: "error", text: "Control Plane URL not configured. Check NEXT_PUBLIC_CONTROL_PLANE_URL." });
      setLoading(false);
      return;
    }
    const url = mode === "signup"
      ? `${CP_URL}/api/v1/auth/register`
      : `${CP_URL}/api/v1/auth/login`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      let data: { user?: { id: string }; token?: string; message?: string };
      try {
        data = await res.json();
      } catch {
        setMessage({ type: "error", text: "Invalid response from server. Is the Control Plane running?" });
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? (mode === "signup" ? "Registration failed." : "Invalid email or password.") });
        setLoading(false);
        return;
      }
      if (!data.user?.id) {
        setMessage({ type: "error", text: data.message ?? "Unexpected response from server." });
        setLoading(false);
        return;
      }
      if (data.token) {
        try { localStorage.setItem(BILLING_TOKEN_KEY, data.token); } catch (_) {}
      }
      onSuccess(data.user.id);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === "AbortError") {
        setMessage({ type: "error", text: `Request timed out. Is the Control Plane running at ${CP_URL}?` });
      } else {
        setMessage({ type: "error", text: err?.message ?? "Network error. Check if the Control Plane is running." });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>JoinCloud</h1>
        <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginBottom: 20 }}>
          {devModePrompt ?? "Sign in or create an account to view and manage your plans."}
        </p>
        {deviceId && (
          <div style={{ background: "var(--surface-elevated)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "var(--foreground-soft)" }}>
            Device: <span style={{ fontFamily: "monospace", color: "var(--foreground)" }}>{deviceId.slice(0, 16)}…</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            className={`btn ${mode === "signin" ? "btn-primary" : "btn-secondary"}`}
            style={{ flex: 1, padding: "10px" }}
            onClick={() => { setMode("signin"); setMessage(null); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`btn ${mode === "signup" ? "btn-primary" : "btn-secondary"}`}
            style={{ flex: 1, padding: "10px" }}
            onClick={() => { setMode("signup"); setMessage(null); }}
          >
            Sign up
          </button>
        </div>
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
              disabled={loading}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
            />
          </div>
          {message && (
            <p style={{ fontSize: 14, color: message.type === "error" ? "#ef4444" : "#22c55e", margin: 0 }}>{message.text}</p>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in and view plans" : "Create account and view plans"}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--foreground-soft)", textAlign: "center" }}>
          After signing in you will be redirected to the plans page.
        </p>
      </div>
    </main>
  );
}

type PaymentMode = "LIVE" | "DEV";
type SubscriptionMode = "automatic" | "manual";

interface PlanRequestModalProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  deviceId: string;
  accountId: string;
  customUsers?: number | null;
  customDevices?: number | null;
  requestedDays?: number | null;
  requestedShareLimit?: number | null;
  requestedDeviceLimit?: number | null;
}

function PlanRequestModal({
  open,
  onClose,
  planId,
  planName,
  deviceId,
  accountId,
  customUsers,
  customDevices,
  requestedDays,
  requestedShareLimit,
  requestedDeviceLimit,
}: PlanRequestModalProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPhone("");
      setSubmitting(false);
      setMessage(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!CP_URL) {
      setMessage({ type: "error", text: "Control Plane URL not configured. Check NEXT_PUBLIC_CONTROL_PLANE_URL." });
      return;
    }
    if (!email) {
      setMessage({ type: "error", text: "Email is required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${CP_URL}/api/v1/subscription/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          email,
          phone: phone || undefined,
          account_id: accountId || undefined,
          device_id: deviceId || undefined,
          custom_users: customUsers ?? undefined,
          custom_devices: customDevices ?? undefined,
          requested_days: requestedDays ?? undefined,
          requested_share_limit: requestedShareLimit ?? undefined,
          requested_device_limit: requestedDeviceLimit ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "Could not send request. Please try again." });
        setSubmitting(false);
        return;
      }
      setMessage({ type: "success", text: "Request sent. We'll email you shortly to complete payment." });
      setTimeout(() => { onClose(); }, 1500);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message ?? "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24, background: "black" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Request {planName} plan</h2>
        <p style={{ fontSize: 14, color: "var(--foreground-soft)", marginBottom: 16 }}>
          Enter your email (required) and phone (optional). An admin will contact you to complete payment and activate your plan.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} placeholder="+91-XXXXXXXXXX" />
          </div>
          {(customUsers != null || customDevices != null) && (
            <div style={{ fontSize: 13, color: "var(--foreground-soft)" }}>
              {customUsers != null && <div>Requested users: {customUsers}</div>}
              {customDevices != null && <div>Requested devices: {customDevices}</div>}
            </div>
          )}
          {message && (
            <p style={{ fontSize: 13, color: message.type === "error" ? "#ef4444" : "#22c55e", margin: 0 }}>{message.text}</p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Sending…" : "Send request"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BillingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const accountId = params.get("accountId") ?? "";
  const deviceId  = params.get("deviceId")  ?? "";

  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successPlan, setSuccessPlan] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [subscriptionMode, setSubscriptionMode] = useState<SubscriptionMode>("automatic");
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestPlanId, setRequestPlanId] = useState<string>("pro");
  const [requestCustomUsers, setRequestCustomUsers] = useState<number | null>(null);
  const [requestCustomDevices, setRequestCustomDevices] = useState<number | null>(null);
  const [requestRequestedDays, setRequestRequestedDays] = useState<number | null>(null);
  const [requestRequestedShareLimit, setRequestRequestedShareLimit] = useState<number | null>(null);
  const [requestRequestedDeviceLimit, setRequestRequestedDeviceLimit] = useState<number | null>(null);
  const [requestCustomDays, setRequestCustomDays] = useState<number>(365);

  useEffect(() => {
    if (!CP_URL) return;
    fetch(`${CP_URL}/api/v1/public/billing-mode`)
      .then((r) => r.json())
      .then((d: { payment_mode?: PaymentMode; subscription_mode?: SubscriptionMode }) => {
        setPaymentMode(d.payment_mode ?? "LIVE");
        if (d.subscription_mode === "manual" || d.subscription_mode === "automatic") {
          setSubscriptionMode(d.subscription_mode);
        }
      })
      .catch(() => { setPaymentMode("LIVE"); setSubscriptionMode("automatic"); });
  }, []);

  const hasToken = typeof window !== "undefined" ? !!localStorage.getItem(BILLING_TOKEN_KEY) : false;
  const needsSignInForDev = subscriptionMode === "automatic" && paymentMode === "DEV" && accountId && !hasToken;

  if (!accountId || needsSignInForDev) {
    const handleAuthSuccess = (newAccountId: string) => {
      const search = new URLSearchParams();
      search.set("accountId", newAccountId);
      if (deviceId) search.set("deviceId", deviceId);
      router.replace(`/billing?${search.toString()}`);
    };
    return (
      <AuthScreen
        onSuccess={handleAuthSuccess}
        deviceId={deviceId}
        devModePrompt={needsSignInForDev ? "Sign in to activate plans (required for DEV billing mode)" : undefined}
      />
    );
  }

  function handleCustomRequest() {
    const subject = encodeURIComponent("JoinCloud Custom Plan Inquiry");
    const body = encodeURIComponent("Hello Team,\n\nI'm interested in the JoinCloud Custom plan. Please let me know how to proceed.\n\nThank you!");
    const to = "vinay@arevei.com";
    const cc = "rishabh@arevei.com";
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `mailto:${to}?cc=${cc}&subject=${subject}&body=${body}`;
    } else {
      window.location.href = `https://mail.google.com/mail/?view=cm&to=${to}&cc=${cc}&su=${subject}&body=${body}`;
    }
  }

  async function handleBuy(plan: Plan | CustomPlan) {
    if ("isCustom" in plan && plan.isCustom) {
      handleCustomRequest();
      return;
    }
    setError("");
    setLoading(plan.id);
    try {
      if (paymentMode === "DEV") {
        const token = typeof window !== "undefined" ? localStorage.getItem(BILLING_TOKEN_KEY) : null;
        if (!token) {
          setError("Please sign in again to activate a plan.");
          setLoading(null);
          return;
        }
        const planUpper = plan.id === "pro_plus" ? "PRO_PLUS" : plan.id.toUpperCase();
        const activateRes = await fetch(`${CP_URL}/api/v1/dev/activate-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan: planUpper, deviceId: deviceId || null }),
        });
        const activateData = await activateRes.json();
        if (!activateRes.ok) {
          setError(activateData.message ?? "Activation failed.");
          setLoading(null);
          return;
        }
        setSuccessPlan(plan.name);
        setLoading(null);
        return;
      }

      // LIVE mode: Razorpay checkout
      const amount = billing === "monthly" ? plan.priceMonthly : plan.priceYearly;
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_paise: amount, receipt: `${plan.id}-${Date.now()}` }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.order_id) {
        setError(orderData.error ?? "Could not create order. Try again.");
        setLoading(null);
        return;
      }

      const rzp = new (window as any).Razorpay({
        key: RAZORPAY_KEY_ID || orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency ?? "INR",
        name: "JoinCloud",
        description: `${plan.name} Plan - ${billing}`,
        order_id: orderData.order_id,
        prefill: {},
        theme: { color: "#2FB7FF" },
        handler: async (response: any) => {
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              account_id: accountId,
              device_id: deviceId,
              plan: plan.id,
              device_limit: String((plan as Plan).deviceLimit),
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.success) {
            setSuccessPlan(plan.name);
          } else {
            setError(verifyData.error ?? "Payment verified but license update failed. Contact support.");
          }
          setLoading(null);
        },
        modal: { ondismiss: () => setLoading(null) },
      });
      rzp.on("payment.failed", (resp: any) => {
        setError(resp?.error?.description ?? "Payment failed.");
        setLoading(null);
      });
      rzp.open();
    } catch (err: any) {
      setError(err?.message ?? "Unexpected error.");
      setLoading(null);
    }
  }

  if (successPlan) {
    return <SuccessScreen successPlan={successPlan} accountId={accountId} deviceId={deviceId} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="beforeInteractive" />
      <main style={{ flex: 1, padding: "48px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {subscriptionMode === "automatic" && paymentMode === "DEV" && (
            <div style={{ background: "#fef3c7", color: "#92400e", padding: "10px 16px", borderRadius: 8, marginBottom: 24, textAlign: "center", fontSize: 14 }}>
              DEV billing mode active — payments bypassed
            </div>
          )}

          <h1 style={{ fontSize: 32, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Choose a plan</h1>
          <p style={{ color: "var(--foreground-soft)", textAlign: "center", marginBottom: 32, fontSize: 14 }}>
            Start with a free 14-day trial — no credit card needed.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 40 }}>
            {(["monthly", "yearly"] as const).map((b) => (
              <button
                key={b}
                className={`btn ${billing === b ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "8px 20px", fontSize: 14 }}
                onClick={() => setBilling(b)}
              >
                {b.charAt(0).toUpperCase() + b.slice(1)}
                {b === "yearly" && (
                  <span style={{ marginLeft: 6, background: "#16a34a22", color: "#22c55e", borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>
                    ~1 month free
                  </span>
                )}
              </button>
            ))}
          </div>

          {error && (
            <p style={{ color: "#ef4444", textAlign: "center", marginBottom: 24, fontSize: 14 }}>{error}</p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {/* Free tier card */}
            <div className="card" style={{ display: "flex", flexDirection: "column", border: "1px solid var(--stroke)" }}>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>Free Plan</h2>
                <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginTop: 4 }}>Personal use, 1 device</p>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>₹0</div>
              <ul style={{ color: "var(--foreground-soft)", fontSize: 14, marginBottom: "auto", paddingLeft: 16, lineHeight: 1.8 }}>
                <li>1 device</li>
                <li>5 shares/month</li>
                <li>No Expiry</li>
                {/* <li>Up to 2 GB per file</li>
                <li>Links expire after 24hr</li>
                <li>Peer chat</li> */}
              </ul>
              {/* <p style={{ color: "var(--foreground-soft)", fontSize: 12, marginTop: 20 }}>
                Default after your trial ends. No action needed.
              </p> */}
            </div>

            {/* Free trial card */}
            <div className="card" style={{ display: "flex", flexDirection: "column", border: "1px solid rgba(47,183,255,0.3)" }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700 }}>Free Trial</h2>
                  <span style={{ background: "#2FB7FF22", color: "#2FB7FF", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>7 days</span>
                </div>
                <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginTop: 4 }}>Pro-like limits, no card needed</p>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>₹0</div>
              <ul style={{ color: "var(--foreground-soft)", fontSize: 14, marginBottom: "auto", paddingLeft: 16, lineHeight: 1.8 }}>
                <li>3 devices</li>
                <li>50 shares/month</li>
                <li>Active on Installation</li>
                <li>Pro-like limits</li>
                {/* <li>Up to 20 GB per file</li>
                <li>Links up to 7 days</li>
                <li>Peer chat</li> */}
              </ul>
              {/* <p style={{ color: "var(--foreground-soft)", fontSize: 12, marginTop: 20 }}>
                Sign in from the desktop app to start your trial.
              </p> */}
            </div>

            {/* Paid plan cards */}
            {PLANS.map((plan) => {
              const isCustom = "isCustom" in plan && plan.isCustom;
              const priceLabel = !isCustom
                ? `₹${(billing === "monthly" ? plan.priceMonthly : plan.priceYearly) / 100}`
                : "";
              const priceSuffix = !isCustom
                ? billing === "monthly" ? "/mo" : "/yr"
                : "";

              return (
                <div
                  key={plan.id}
                  className="card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    border: isCustom ? "1px solid var(--stroke)" : plan.id === "pro" ? "1px solid var(--primary)" : "1px solid rgba(168,85,247,0.5)",
                    position: "relative",
                  }}
                >
                  {plan.badge && (
                    <div style={{
                      position: "absolute", top: -1, right: 16,
                      background: plan.id === "pro" ? "var(--primary)" : "#a855f7",
                      color: "white", borderRadius: "0 0 6px 6px",
                      padding: "2px 10px", fontSize: 11, fontWeight: 600,
                    }}>
                      {plan.badge}
                    </div>
                  )}
                  <div style={{ marginBottom: 16, paddingTop: plan.badge ? 8 : 0 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{plan.name}</h2>
                    <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginTop: 4 }}>{plan.description}</p>
                  </div>
                  {!isCustom ? (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 36, fontWeight: 800 }}>{priceLabel}</span>
                      <span style={{ color: "var(--foreground-soft)", fontSize: 14 }}>{priceSuffix}</span>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: "var(--foreground-soft)", fontSize: 14 }}>Pricing agreed directly with you</span>
                    </div>
                  )}
                  <ul style={{ color: "var(--foreground-soft)", fontSize: 14, marginBottom: "auto", paddingLeft: 16, lineHeight: 1.8 }}>
                    {plan.features.map((f) => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                  {isCustom ? (
                    <div style={{ marginTop: 24 }}>
                      {subscriptionMode === "manual" ? (
                        <>
                          <div style={{ marginBottom: 12 }}>
                            <label className="label" style={{ fontSize: 12 }}>Requested duration (days)</label>
                            <input
                              className="input"
                              type="number"
                              min={1}
                              max={365}
                              value={requestCustomDays}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                setRequestCustomDays(Number.isFinite(v) ? Math.min(365, Math.max(1, v)) : 365);
                              }}
                              style={{ width: "100%", padding: "8px 12px", fontSize: 14 }}
                            />
                          </div>
                          <button
                            className="btn btn-primary"
                            style={{ width: "100%" }}
                            onClick={() => {
                              setRequestPlanId(plan.id);
                              setRequestCustomUsers(null);
                              setRequestCustomDevices(null);
                              setRequestRequestedDays(requestCustomDays);
                              setRequestRequestedShareLimit(null);
                              setRequestRequestedDeviceLimit(null);
                              setRequestModalOpen(true);
                            }}
                          >
                            Request Custom plan
                          </button>
                          <p style={{ marginTop: 8, fontSize: 12, color: "var(--foreground-soft)" }}>
                            Sends a request to your admin. Payment arranged manually.
                          </p>
                        </>
                      ) : (
                        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => handleCustomRequest()}>
                          Contact us
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 24, background: plan.id === "pro_plus" ? "#a855f7" : undefined, borderColor: plan.id === "pro_plus" ? "#a855f7" : undefined }}
                      disabled={loading === plan.id}
                      onClick={() => {
                        if (subscriptionMode === "manual") {
                          setRequestPlanId(plan.id);
                          setRequestCustomUsers(null);
                          setRequestCustomDevices(null);
                          setRequestRequestedDays(billing === "monthly" ? 30 : 365);
                          setRequestRequestedShareLimit(plan.id === "pro" ? 50 : null);
                          setRequestRequestedDeviceLimit((plan as Plan).deviceLimit);
                          setRequestModalOpen(true);
                        } else {
                          handleBuy(plan);
                        }
                      }}
                    >
                      {subscriptionMode === "manual"
                        ? `Request ${plan.name}`
                        : loading === plan.id
                          ? "Opening checkout…"
                          : `Get ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ color: "var(--foreground-soft)", textAlign: "center", marginTop: 40, fontSize: 13 }}>
            {subscriptionMode === "manual"
              ? "Plan payments are handled manually after we contact you by email or phone."
              : "Payments processed securely via Razorpay. Prices in INR. Cancel anytime from the desktop app's Billing section."}
          </p>

          <PlanRequestModal
            open={requestModalOpen}
            onClose={() => setRequestModalOpen(false)}
            planId={requestPlanId}
            planName={PLANS.find((p) => p.id === requestPlanId)?.name ?? requestPlanId}
            deviceId={deviceId}
            accountId={accountId}
            customUsers={requestCustomUsers}
            customDevices={requestCustomDevices}
            requestedDays={requestRequestedDays}
            requestedShareLimit={requestRequestedShareLimit}
            requestedDeviceLimit={requestRequestedDeviceLimit}
          />
        </div>
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "var(--foreground-soft)" }}>Loading…</p></main>}>
      <BillingContent />
    </Suspense>
  );
}
