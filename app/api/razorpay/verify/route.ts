import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const CP_URL = process.env.CONTROL_PLANE_URL ?? "";

export async function POST(req: NextRequest) {
  if (!KEY_SECRET) {
    return NextResponse.json({ error: "Razorpay not configured." }, { status: 503 });
  }

  let body: {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
    account_id?: string;
    plan?: string;
    device_limit?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, account_id, plan, device_limit } = body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing Razorpay payment fields." }, { status: 400 });
  }

  // Verify signature: HMAC-SHA256(order_id|payment_id, KEY_SECRET)
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(razorpay_signature, "hex")
    );
  } catch {
    valid = false;
  }

  if (!valid) {
    console.warn("Razorpay signature verification failed");
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  // Forward to Control Plane to issue/update the license
  if (!CP_URL) {
    console.error("CONTROL_PLANE_URL not set; cannot issue license after payment.");
    return NextResponse.json({ success: true, warning: "License update skipped - CONTROL_PLANE_URL not configured." });
  }

  try {
    const cpRes = await fetch(`${CP_URL}/api/v1/webhooks/razorpay-manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_payment_id, razorpay_order_id, razorpay_signature, account_id, plan, device_limit }),
    });
    const cpData = await cpRes.json() as any;
    if (!cpRes.ok) {
      console.error("Control Plane license update failed:", cpData);
      return NextResponse.json({ error: cpData?.message ?? "License update failed after payment." }, { status: 502 });
    }
    return NextResponse.json({ success: true, license_id: cpData.license_id });
  } catch (err: any) {
    console.error("Could not reach Control Plane after payment:", err?.message);
    return NextResponse.json({ success: true, warning: "Payment recorded but license update could not be confirmed. It will sync automatically." });
  }
}
