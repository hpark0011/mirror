import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval for HMR and inline scripts
  "style-src 'self' 'unsafe-inline'", // Tailwind and runtime style injection
  "img-src 'self' https://images.unsplash.com data:", // data: for Tiptap/ProseMirror inline images
  "font-src 'self'", // next/font self-hosts all fonts
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.daily.co wss://*.daily.co https://tavusapi.com", // Convex real-time backend + Sentry telemetry + Daily.co + Tavus API
  "frame-src https://*.daily.co", // Daily.co video iframe
  "media-src 'self' https://*.daily.co blob:", // Daily.co media + blob URLs
  "frame-ancestors 'none'", // mirrors X-Frame-Options: DENY
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: ["@convex-dev/agent"],
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
          value: "camera=(self), microphone=(self), geolocation=(), payment=()",
        },
      ],
    },
  ],
  rewrites: async () => [
    { source: "/@:username/chat", destination: "/:username/chat" },
    { source: "/@:username/chat/:conversationId", destination: "/:username/chat/:conversationId" },
    { source: "/@:username", destination: "/:username" },
    { source: "/@:username/articles", destination: "/:username/articles" },
    { source: "/@:username/articles/:slug", destination: "/:username/articles/:slug" },
    { source: "/@:username/posts", destination: "/:username/posts" },
    { source: "/@:username/posts/:slug", destination: "/:username/posts/:slug" },
  ],
};

const hasSentryUploadConfig = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  sourcemaps: {
    disable: !hasSentryUploadConfig,
  },
  widenClientFileUpload: hasSentryUploadConfig,
});
