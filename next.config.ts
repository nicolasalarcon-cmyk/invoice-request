import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  eslint: { ignoreDuringBuilds: true },
  webpack(config) {
    config.module.rules.push({
      test: /\.(ttf|woff|woff2|eot|otf)$/,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
