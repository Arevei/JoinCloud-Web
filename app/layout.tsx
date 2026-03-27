import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JoinCloud",
  description: "JoinCloud - secure file sharing and device management",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
    other: {
      rel: "icon",
      url: "/logo.png",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
