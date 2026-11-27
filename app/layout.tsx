import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "מסלול יומי",
  description: "תכנון מסלול נסיעה יומי לבעל העסק ולמזכירה",
  applicationName: "מסלול יומי",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "מסלול יומי", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6e56",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${rubik.className} min-h-dvh bg-canvas text-ink antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
