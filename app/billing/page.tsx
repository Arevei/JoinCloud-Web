"use client";

import { useState, Suspense } from "react";
import Script from "next/script";
import { useSearchParams, useRouter } from "next/navigation";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const CP_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "";

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthlyPaise: number;
  priceYearlyPaise: number;
  deviceLimit: number;
  features: string[];
  isCustom?: false;
}

interface CustomPlan {
  id: string;
  name: string;
  description: string;
  isCustom: true;
  features: string[];
}

const PLANS: (Plan | CustomPlan)[] = [
  {
    id: "pro",
    name: "Pro",
    description: "Single user, up to 5 devices",
    priceMonthlyPaise: 49900,
    priceYearlyPaise: 499900,
    deviceLimit: 5,
    features: ["Up to 5 devices", "Full LAN sharing", "Priority support", "Past payments history"],
  },
  {
    id: "team",
    name: "Team",
    description: "Up to 5 users, 5 devices",
    priceMonthlyPaise: 149900,
    priceYearlyPaise: 1499900,
    deviceLimit: 5,
    features: ["5 users, 5 devices", "Everything in Pro", "Team management", "Admin control panel"],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Custom users/storage and pairing devices",
    isCustom: true,
    features: ["Custom users/storage limit", "Custom pairing device limit", "Granted by your admin", "Email with license data on grant"],
  },
];

function formatINR(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

function AuthScreen({ onSuccess, deviceId }: { onSuccess: (accountId: string) => void; deviceId: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await fetch(`${CP_URL}/api/v1/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ type: "error", text: data.message ?? "Registration failed." });
          setLoading(false);
          return;
        }
        if (data.user?.id) {
          onSuccess(data.user.id);
          return;
        }
      } else {
        const res = await fetch(`${CP_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.user?.id) {
          setMessage({ type: "error", text: data.message ?? "Invalid email or password." });
          setLoading(false);
          return;
        }
        onSuccess(data.user.id);
        return;
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message ?? "Network error." });
    }
    setLoading(false);
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>JoinCloud</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
          Sign in or create an account to view and manage your plans.
        </p>
        {deviceId && (
          <div style={{ background: "var(--surface-elevated)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "var(--muted)" }}>
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
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
          After signing in you will be redirected to the plans page.
        </p>
      </div>
    </main>
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
  const [customX, setCustomX] = useState("");
  const [customY, setCustomY] = useState("");

  if (!accountId) {
    const handleAuthSuccess = (newAccountId: string) => {
      const search = new URLSearchParams();
      search.set("accountId", newAccountId);
      if (deviceId) search.set("deviceId", deviceId);
      router.replace(`/billing?${search.toString()}`);
    };
    return <AuthScreen onSuccess={handleAuthSuccess} deviceId={deviceId} />;
  }

  function handleCustomRequest() {
    const x = customX.trim() || "X";
    const y = customY.trim() || "Y";
    const subject = encodeURIComponent(`Subscription Inquiry: ${x} Rupees for ${y} Devices`);
    const body = encodeURIComponent(
      "Hello Team,\n\nI would like to purchase the JoinCloud plan for Rs. " + x + " covering " + y + " devices. Please let me know how to proceed with the payment.\n\nThank you!"
    );
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
      const amount = billing === "monthly" ? plan.priceMonthlyPaise : plan.priceYearlyPaise;
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
        description: `${plan.name} Plan — ${billing}`,
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
              device_limit: String(plan.deviceLimit),
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
        modal: {
          ondismiss: () => setLoading(null),
        },
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
    const refreshLink = `joincloud://refresh?accountId=${encodeURIComponent(accountId)}${deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""}`;
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Payment successful!</h1>
          <p style={{ color: "var(--muted)", marginBottom: 20 }}>
            Your <strong>{successPlan}</strong> plan is now active.
          </p>
          <a
            href={refreshLink}
            className="btn btn-primary"
            style={{ display: "inline-block", padding: "12px 32px", textDecoration: "none" }}
          >
            Open JoinCloud Desktop
          </a>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 16 }}>
            The desktop app will detect your upgrade immediately. You can also close this window.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="beforeInteractive" />

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Choose a plan</h1>
        <p style={{ color: "var(--muted)", textAlign: "center", marginBottom: 32 }}>
          Start with a free 7-day trial — no email needed. Upgrade any time.
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
                  ~2 months free
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ color: "#ef4444", textAlign: "center", marginBottom: 24, fontSize: 14 }}>{error}</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {/* Free trial card */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Free Trial</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>7 days, up to 5 devices</p>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>₹0</div>
            <ul style={{ color: "var(--muted)", fontSize: 14, marginBottom: "auto", paddingLeft: 16 }}>
              <li>5 devices</li>
              <li>Full LAN sharing</li>
              <li>No credit card required</li>
            </ul>
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 20 }}>
              Sign in from the desktop app to start your free trial.
            </p>
          </div>

          {/* Paid plan cards */}
          {PLANS.map((plan) => {
            const isCustom = "isCustom" in plan && plan.isCustom;
            const price = !isCustom && "priceMonthlyPaise" in plan
              ? (billing === "monthly" ? plan.priceMonthlyPaise : plan.priceYearlyPaise)
              : 0;
            return (
              <div key={plan.id} className="card" style={{ display: "flex", flexDirection: "column", border: isCustom ? "1px solid var(--border)" : "1px solid var(--primary)" }}>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700 }}>{plan.name}</h2>
                  <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>{plan.description}</p>
                </div>
                {!isCustom ? (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 36, fontWeight: 800 }}>{formatINR(price)}</span>
                    <span style={{ color: "var(--muted)", fontSize: 14 }}>/{billing === "monthly" ? "mo" : "yr"}</span>
                  </div>
                ) : (
                  <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 600, color: "var(--muted)" }}>By request</div>
                )}
                <ul style={{ color: "var(--muted)", fontSize: 14, marginBottom: "auto", paddingLeft: 16 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ marginBottom: 4 }}>✓ {f}</li>
                  ))}
                </ul>
                {isCustom ? (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 120px" }}>
                        <label className="label" style={{ fontSize: 12 }}>X (Rupees)</label>
                        <input
                          className="input"
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 5000"
                          value={customX}
                          onChange={(e) => setCustomX(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", fontSize: 14 }}
                        />
                      </div>
                      <div style={{ flex: "1 1 120px" }}>
                        <label className="label" style={{ fontSize: 12 }}>Y (Devices)</label>
                        <input
                          className="input"
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 10"
                          value={customY}
                          onChange={(e) => setCustomY(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", fontSize: 14 }}
                        />
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: "100%" }}
                      onClick={() => handleCustomRequest()}
                    >
                      Get Pro — Send email request
                    </button>
                    <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                      Opens your email app with X and Y filled in. Desktop: Gmail; mobile: mailto.
                    </p>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 24 }}
                    disabled={loading === plan.id}
                    onClick={() => handleBuy(plan)}
                  >
                    {loading === plan.id ? "Opening checkout…" : `Get ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 40, fontSize: 13 }}>
          Payments processed securely via Razorpay. Prices in INR. Cancel anytime from the desktop app&apos;s Billing section.
        </p>
      </div>
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "var(--muted)" }}>Loading…</p></main>}>
      <BillingContent />
    </Suspense>
  );
}
