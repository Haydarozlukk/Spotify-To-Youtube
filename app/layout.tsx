import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000"),
  title: "Playlist Pilot — Müziğin aynı, adresi değişiyor",
  description: "Spotify listelerini akıllı eşleştirme ve insan denetimiyle YouTube Music'e taşı.",
  openGraph: {
    title: "Playlist Pilot — Spotify → YouTube Music",
    description: "Akıllı eşleştirme ve insan denetimiyle playlistlerini güvenle taşı.",
    type: "website",
    locale: "tr_TR",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Playlist Pilot sosyal paylaşım görseli" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Playlist Pilot — Spotify → YouTube Music",
    description: "Müziğin aynı. Adresi değişiyor.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
