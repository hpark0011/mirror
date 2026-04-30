import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live", // Next.js requires unsafe-inline/eval for HMR and inline scripts; va.vercel-scripts.com hosts Vercel Analytics + Speed Insights; vercel.live hosts the Vercel Toolbar/Live Feedback on preview deployments
  "style-src 'self' 'unsafe-inline' https://vercel.live", // Tailwind and runtime style injection; vercel.live for Vercel Toolbar styles
  "img-src 'self' https://images.unsplash.com https://*.convex.cloud https://*.convex.site https://vercel.live https://vercel.com data: blob:", // data/blob previews plus Convex-hosted user images; vercel.live + vercel.com for Vercel Toolbar avatars/icons
  "font-src 'self' https://vercel.live https://assets.vercel.com", // next/font self-hosts all fonts; Vercel Toolbar pulls fonts from vercel.live + assets.vercel.com
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.daily.co wss://*.daily.co https://tavusapi.com https://vercel.live wss://ws-us3.pusher.com", // Convex real-time backend + Sentry telemetry + Daily.co + Tavus API + Vercel Toolbar (vercel.live + Pusher websocket for live comments)
  "frame-src https://*.daily.co https://vercel.live", // Daily.co video iframe + Vercel Toolbar iframe
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
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "*.convex.site",
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
    { source: "/@:username/clone-settings", destination: "/:username/clone-settings" },
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
