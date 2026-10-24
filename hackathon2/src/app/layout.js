import { Public_Sans } from "next/font/google";
import ThemeScript from "@/components/shell/ThemeScript";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: { default: "HCM Lite", template: "%s | HCM Lite" },
  description: "HR, attendance, leave and payroll for small companies",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
