import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Route Zero",
  description: "Roll a Pokemon story-run team with game and availability filters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
