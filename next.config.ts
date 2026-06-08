import type { NextConfig } from "next";

const chatServiceUrl = "https://harmonious-empathy.up.railway.app";

console.log("[next.config] CHAT_SERVICE_URL =", chatServiceUrl);

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
