import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Uber – Request a Ride",
  description:
    "Request a ride, see prices, and get picked up by a nearby driver. Uber for India.",
  keywords: "uber, ride, taxi, cab, auto, bike, UberGo, UberXL",
  openGraph: {
    title: "Uber – Request a Ride",
    description: "Get a ride in minutes. Uber in India.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        variables: {
          colorPrimary: '#000000',
          borderRadius: '0.75rem',
        },
        elements: {
          formButtonPrimary: 'bg-black hover:bg-neutral-800 text-white font-semibold py-3 rounded-xl',
          card: 'rounded-2xl shadow-xl',
          modalContent: 'rounded-2xl shadow-2xl overflow-hidden',
        },
      }}
    >
      <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <body className="h-full flex flex-col overflow-hidden">{children}</body>
      </html>
    </ClerkProvider>
  );
}
