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
          // Grab the existing rule that handles SVG imports
          const fileLoaderRule = config.module.rules.find(
            (rule: { test?: { test?: (arg0: string) => boolean } }) =>
              rule.test?.test?.(".svg")
          );

          config.module.rules.push(
            // Reapply the existing rule, but only for svg imports ending in ?url
            {
              ...fileLoaderRule,
              test: /\.svg$/i,
              resourceQuery: /url/, // *.svg?url
            },
            // Convert all other *.svg imports to React components
            {
              test: /\.svg$/i,
              issuer: fileLoaderRule.issuer,
              resourceQuery: {
                not: [...fileLoaderRule.resourceQuery.not, /url/],
              }, // exclude if *.svg?url
              use: ["@svgr/webpack"],
            }
          );

          // Modify the file loader rule to ignore *.svg, since we have it handled now.
          fileLoaderRule.exclude = /\.svg$/i;

          return config;
        },
      }
    : {}),

  turbopack: {
    rules: {
      "*.svg": {
        loaders: [
          {
            loader: "@svgr/webpack",
            options: {
              icon: true,
            },
          },
        ],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
