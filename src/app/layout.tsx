import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "I-O/Quant Psych Research Feed",
  description: "Your personalized research inbox for organizational and I/O psychology.",
};

/**
 * Applies the stored theme before first paint.
 *
 * Without this the page renders light, then React hydrates and switches —
 * a white flash on every load for anyone reading in dark mode, which is
 * precisely when it is most unpleasant. It has to be inline and synchronous
 * in <head> for that reason; a deferred script is already too late.
 *
 * Mirrors `useTheme`'s applyTheme. Wrapped in try/catch because localStorage
 * throws outright in some privacy modes, and a theme preference is never worth
 * breaking the page over.
 */
const THEME_SCRIPT = `
try {
  var p = JSON.parse(localStorage.getItem('stats-feed:theme') || '"system"');
  if (p === 'light' || p === 'dark') document.documentElement.setAttribute('data-theme', p);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/*
          Wraps the whole app because the magic-link landing page at
          /auth/confirm needs the same auth context the feed does. When no
          Supabase project is configured the provider resolves immediately to
          "unconfigured" and makes no network calls, so the localStorage-only
          experience is unchanged.
        */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
