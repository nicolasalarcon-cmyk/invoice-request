import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "SolicitudesUC · UdeCataluña",
  description:
    "Plataforma de gestión y aprobación de recibos de pago para la Corporación Universitaria de Cataluña.",
  authors: [{ name: "UdeCataluña" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "SolicitudesUC · UdeCataluña",
    description:
      "Plataforma de gestión y aprobación de recibos de pago para la Corporación Universitaria de Cataluña.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
