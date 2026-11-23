import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SITE_URL } from "@/lib/supabase/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "SolveANeed — Every Need Deserves a Solution.", template: "%s · SolveANeed" },
  description:
    "SolveANeed connects people with genuine needs to individuals, businesses and organisations willing to help — through giving, paid tasks, milestone funding and direct solutions.",
  applicationName: "SolveANeed",
  openGraph: {
    type: "website",
    siteName: "SolveANeed",
    title: "SolveANeed — Every Need Deserves a Solution.",
    description: "Post a Need. Solve a Need. GIVE • EARN • FUND • SOLVE",
    url: "/",
    locale: "en_GB",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "SolveANeed — Every Need Deserves a Solution." }],
  },
  twitter: { card: "summary_large_image", title: "SolveANeed", description: "Every Need Deserves a Solution." },
};

export const viewport: Viewport = {
  themeColor: "#10223B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        <div id="main" className="flex flex-1 flex-col" tabIndex={-1}>
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
