import Header from "@/components/Header";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />

      {/* Main Content */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <img src="/joincloud-logo.png" alt="JoinCloud" style={{ height: 56, width: "auto", marginBottom: 16, marginLeft: "auto", marginRight: "auto", display: "block" }} />
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: "var(--foreground)" }}>JoinCloud</h1>
          <p style={{ color: "var(--foreground-soft)", marginBottom: 24, fontSize: 14 }}>
            A Personal Cloud Network for secure high-speed LAN file sharing and collaboration.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/billing" className="btn btn-primary" style={{ textDecoration: "none", padding: "10px 20px", color: "var(--bg)" }}>
              View Plans
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
