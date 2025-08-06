import type { NextConfig } from "next";
// @ts-expect-error - No types available for this plugin
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    position: "bottom-right",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  ...(process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production"
    ? {
        webpack: (config, { isServer }) => {
          if (isServer) {
            config.plugins = [...config.plugins, new PrismaPlugin()];
          }
          return config;
        },
      }
    : {}),
};

export default nextConfig;
