import type { Metadata } from "next";
import { Comfortaa, Nunito } from "next/font/google";
import "./globals.css";

const comfortaa = Comfortaa({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "700"],
  variable: "--font-display",
});

const nunito = Nunito({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Перепёлочка — генератор листочков",
  description: "Генерация подкладных карточек для детских цимбал «Перепёлочка» из MIDI и ABC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${comfortaa.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
