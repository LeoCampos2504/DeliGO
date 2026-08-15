import type { NextConfig } from "next";

const chatServiceUrl = process.env.REALTIME_SERVICE_URL?.trim();

const nextConfig: NextConfig = {
  output: "standalone",

  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,

  async rewrites() {
    if (!chatServiceUrl) return [];
    return [{
      source: "/socket.io/:path*",
      destination: `${chatServiceUrl}/socket.io/:path*`,
    }];
  },
};

export default nextConfig;
