import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/og.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, immutable" }],
      },
      {
        source: "/favicon.svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, immutable" }],
      },
    ];
  },
};

export default nextConfig;
