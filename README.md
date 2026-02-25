# joincloud-web

Next.js 14 website for JoinCloud user-facing authentication, plan billing (Razorpay), and account dashboard.

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing page with links to sign in and view plans |
| `/auth/desktop?deviceId=DEVICE_UUID` | Login page for desktop app deep-link auth flow |
| `/billing?accountId=ACCOUNT_ID` | Razorpay plan checkout (Pro / Team) |
| `/dashboard?accountId=ACCOUNT_ID` | User dashboard — plan, renewal, payment provider |

## API Routes

| Route | Purpose |
|---|---|
| `POST /api/razorpay/create-order` | Creates a Razorpay order; returns `order_id`, `key_id`, `amount`, `currency` |
| `POST /api/razorpay/verify` | Verifies Razorpay payment signature; calls Control Plane to issue/update license |

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in values:

```
NEXT_PUBLIC_CONTROL_PLANE_URL=https://your-control-plane.com
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
CONTROL_PLANE_URL=https://your-control-plane.com
```

## Development

```bash
cd joincloud-web
npm install
npm run dev   # http://localhost:3000
```

## Desktop auth flow

1. User clicks "Sign In with JoinCloud" in the desktop app.
2. Desktop opens `https://joincloud.com/auth/desktop?deviceId=HOST_UUID` in the browser.
3. User enters email + password on this page.
4. Page calls Control Plane `/api/v1/auth/login` → JWT, then `/api/v1/auth/desktop-token` → one-time token.
5. Page redirects to `joincloud://auth?token=TOKEN`.
6. Electron app handles the deep link, calls local server `/api/desktop/verify`, receives signed license.
7. License is saved to `license.json`; UI refreshes.

## Payment flow

1. Desktop opens `https://joincloud.com/billing?accountId=ACCOUNT_ID`.
2. User picks a plan and clicks Buy.
3. Page calls `/api/razorpay/create-order` → Razorpay order.
4. Razorpay checkout widget opens in browser.
5. On success, `/api/razorpay/verify` verifies signature and calls Control Plane to issue updated license.
6. Desktop app polls config on next heartbeat and receives new license.

## Production deployment

Deploy to Vercel or any Node.js host. Point `CONTROL_PLANE_URL` to your Admin-Control-Plane server.
Ensure Razorpay webhook is also configured at `POST https://your-control-plane.com/api/v1/webhooks/razorpay`.
