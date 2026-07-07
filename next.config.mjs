/** @type {import('next').NextConfig} */
const nextConfig = {
  // Treat the headless-Chromium packages as external so webpack never tries to
  // bundle their native/binary assets — they are resolved at runtime instead.
  experimental: {
    serverComponentsExternalPackages: [
      "@sparticuz/chromium",
      "puppeteer-core",
      "puppeteer",
    ],
    // Guarantee the brotli-compressed Chromium binary that @sparticuz/chromium
    // decompresses at runtime is included in the /api/pdf serverless function's
    // file trace (Next's tracer can otherwise miss the binary assets).
    outputFileTracingIncludes: {
      "/api/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    },
  },
};

export default nextConfig;
