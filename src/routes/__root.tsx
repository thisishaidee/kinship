import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Kinship";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0a0a0a" },
      {
        name: "description",
        content: "Kinship shows who your fans already love, then helps you pitch them.",
      },
      { property: "og:title", content: "Kinship: a partnership, not a playlist." },
      { property: "og:description", content: "Zero-fabrication partnership pitches from Qloo's taste graph." },
      { property: "og:url", content: "https://kinshipp.vercel.app/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://kinshipp.vercel.app/social-card.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Kinship: A partnership, not a playlist." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://kinshipp.vercel.app/social-card.png" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "https://kinshipp.vercel.app/favicon.svg" },
      { rel: "icon", type: "image/x-icon", href: "https://kinshipp.vercel.app/favicon.ico", sizes: "16x16 32x32 48x48" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "https://kinshipp.vercel.app/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono:wght@500;600&family=Space+Grotesk:wght@400;500;700&display=swap" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
