import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Todo",
  description: "A Todo application using Next.js, FastAPI and PostgreSQL.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
