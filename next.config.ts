import type { NextConfig } from "next";

const chatServiceUrl =
  process.env.CHAT_SERVICE_URL || "http://localhost:3003";

const nextConfig: NextConfig = {
  output: "standalone",

  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,

  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: `${chatServiceUrl}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
