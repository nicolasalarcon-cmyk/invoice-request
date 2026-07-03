import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "FacturasUC · UdeCataluña",
  description:
    "Plataforma de gestión y aprobación de recibos de pago para la Corporación Universitaria de Cataluña.",
  authors: [{ name: "UdeCataluña" }],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "FacturasUC · UdeCataluña",
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
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
