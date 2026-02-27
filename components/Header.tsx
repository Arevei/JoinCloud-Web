export default function Header() {
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 16px",
      background: "var(--header-bg)",
      borderBottom: "1px solid var(--stroke)"
    }}>
      <a
        href="https://joincloud.in"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "var(--foreground)"
        }}
      >
        <img src="/joincloud-logo.png" alt="JoinCloud" style={{ height: 28, width: "auto" }} />
        <span style={{ fontWeight: 700, fontSize: 18 }}>JoinCloud</span>
      </a>
    </header>
  );
}
