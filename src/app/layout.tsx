import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastContainer } from "@/components/ui/toast";
import { KeyboardShortcutsProvider } from "@/components/ui/keyboard-shortcuts";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Ledgerly — Personal Finance Dashboard",
  description:
    "Production-grade personal finance dashboard with multi-ledger support, budgets, and insights.",
  icons: {
    icon: `${basePath}/favicon.ico`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.ico`} sizes="any" />
        {/* Prevent flash — set theme before paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem("theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");document.documentElement.className=t==="dark"?"dark":""}catch(e){}` }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <ToastContainer />
            <KeyboardShortcutsProvider />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
