import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Telegram must load the Mini App over HTTPS, so local dev runs behind a
  // tunnel. Allow common tunnel hosts to reach the dev server.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app", "*.trycloudflare.com"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
