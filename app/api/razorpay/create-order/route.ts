import { NextRequest, NextResponse } from "next/server";

const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

export async function POST(req: NextRequest) {
  if (!KEY_ID || !KEY_SECRET) {
    return NextResponse.json({ error: "Razorpay not configured on this server." }, { status: 503 });
  }

  let body: { amount_paise?: number; receipt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { amount_paise, receipt } = body;
  if (!amount_paise || amount_paise < 100) {
    return NextResponse.json({ error: "amount_paise must be >= 100." }, { status: 400 });
  }

  // Call Razorpay Orders API directly (avoids importing the Node.js SDK which may not be tree-shaken)
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: amount_paise,
      currency: "INR",
      receipt: receipt ?? `receipt_${Date.now()}`,
    }),
  });

  const data = await rzpRes.json() as any;
  if (!rzpRes.ok) {
    console.error("Razorpay create-order error:", data);
    return NextResponse.json({ error: data?.error?.description ?? "Failed to create order." }, { status: 502 });
  }

  return NextResponse.json({
    order_id: data.id,
    key_id: KEY_ID,
    amount: data.amount,
    currency: data.currency,
  });
}
