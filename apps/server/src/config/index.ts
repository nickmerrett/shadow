/**
 * Smart configuration selector
 * Automatically exports the appropriate configuration based on NODE_ENV
 * 
 * - development/test: Uses development schema (local mode, minimal validation)
 * - production: Uses production schema (firecracker mode, strict validation)
 */

import devConfig from "./dev";
import prodConfig from "./prod";

// Get NODE_ENV to determine which config to use
const nodeEnv = process.env.NODE_ENV || "development";

let config: typeof devConfig | typeof prodConfig;

if (nodeEnv === "production") {
  // Production environment: Use Firecracker-focused configuration
  console.log("[CONFIG] Loading production configuration (Firecracker mode)");
  config = prodConfig;
} else {
  // Development/test environment: Use local-focused configuration
  console.log(`[CONFIG] Loading development configuration (Local mode) - NODE_ENV: ${nodeEnv}`);
  config = devConfig;
}

// Default export
export default config;

// Type exports for TypeScript
export type { DevConfig } from "./dev";
export type { ProdConfig } from "./prod";
export type { SharedConfig } from "./shared";