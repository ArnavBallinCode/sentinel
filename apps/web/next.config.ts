import type { NextConfig } from "next";
const config: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || (process.env.API_HOSTPORT ? `http://${process.env.API_HOSTPORT}` : "http://127.0.0.1:8001")}/api/:path*`,
      },
    ];
  },
};
export default config;
