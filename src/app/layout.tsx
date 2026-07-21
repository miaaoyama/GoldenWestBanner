import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Golden West College — Student Portal",
  description: "GWC Student Portal with EOPS eligibility notification",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
