import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteNav } from "@/components/site-nav";
import { getCurrentFamilyUser } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "曲奇堡的小家",
  description: "家庭博客、待办菜单、点餐和买菜清单",
  applicationName: "曲奇堡的小家",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "曲奇堡",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/brand/cookiehome-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f5ef",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentFamilyUser();

  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-[#f8f5ef] text-stone-900">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#f8f5ef]/90 backdrop-blur">
            <SiteNav currentUser={currentUser ? { name: currentUser.name, role: currentUser.role } : null} />
          </header>
          <div className="mobile-shell flex flex-1 flex-col">{children}</div>
          <MobileBottomNav visible={Boolean(currentUser)} />
        </div>
      </body>
    </html>
  );
}
