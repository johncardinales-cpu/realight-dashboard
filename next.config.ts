import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/inventory",
        destination: "/inventory-clean",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
