import { Suspense } from "react";
import Header from "@/components/Header";
import PricingRedirect from "./PricingRedirect";

export default function PricingPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Suspense fallback={<p style={{ color: "var(--foreground-soft)" }}>Redirecting to plans…</p>}>
          <PricingRedirect />
        </Suspense>
      </main>
    </div>
  );
}
