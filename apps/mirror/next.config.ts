import type { NextConfig } from "next";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval for HMR and inline scripts
  "style-src 'self' 'unsafe-inline'", // Tailwind and runtime style injection
  "img-src 'self' https://images.unsplash.com data:", // data: for Tiptap/ProseMirror inline images
  "font-src 'self'", // next/font self-hosts all fonts
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud", // Convex real-time backend
  "frame-ancestors 'none'", // mirrors X-Frame-Options: DENY
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        {
          key: "Content-Security-Policy",
          value: cspDirectives,
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=()",
        },
      ],
    },
  ],
  rewrites: async () => [
    { source: "/@:username", destination: "/:username" },
    { source: "/@:username/:slug", destination: "/:username/:slug" },
  ],
};

export default nextConfig;
