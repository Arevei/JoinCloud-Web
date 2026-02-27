"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PricingRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const q = params.toString();
    router.replace(q ? `/billing?${q}` : "/billing");
  }, [router, params]);

  return <p style={{ color: "var(--foreground-soft)" }}>Redirecting to plans…</p>;
}
