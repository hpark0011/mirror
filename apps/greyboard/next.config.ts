/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for production Electron builds
  output: process.env.ELECTRON_BUILD === "true" ? "standalone" : undefined,
  // Transpile workspace packages
  transpilePackages: [
    "@feel-good/greyboard-core",
    "@feel-good/icons",
    "@feel-good/ui",
    "@feel-good/utils",
  ],
  // Skip TypeScript checks during production builds
  // (these run in CI via separate type-check commands)
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
