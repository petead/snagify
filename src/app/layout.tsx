import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snagify",
  description: "Snagify application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
