"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/Header";

export default function PricingPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const q = params.toString();
    router.replace(q ? `/billing?${q}` : "/billing");
  }, [router, params]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--foreground-soft)" }}>Redirecting to plans…</p>
      </main>
    </div>
  );
}
