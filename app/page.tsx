export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <img src="/logo.png" alt="JoinCloud" style={{ width: 64, marginBottom: 16 }} />
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>JoinCloud</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          Secure LAN-first file sharing with paid plan management.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/auth/desktop" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Sign In (Desktop)
          </a>
          <a href="/billing" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            View Plans
          </a>
        </div>
      </div>
    </main>
  );
}
