import type { Metadata } from "next";
import { Geist, IM_Fell_English } from "next/font/google";
import "./globals.css";
const sans = Geist({ subsets: ["latin"], variable: "--sans" });
const serif = IM_Fell_English({ subsets: ["latin"], weight: "400", style: ["normal","italic"], variable: "--serif" });
export const metadata: Metadata = { title: { default: "The Owlery · Hog Wumbia", template: "%s · The Owlery" }, description: "Hog Wumbia's private editorial office.", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${serif.variable}`}><body>{children}</body></html>;
}
