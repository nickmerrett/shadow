"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const configSchema = zod_1.z.object({
    API_PORT: zod_1.z.coerce.number().default(4000),
    SOCKET_PORT: zod_1.z.coerce.number().default(4001),
    CLIENT_URL: zod_1.z.string().default("http://localhost:3000"),
    NODE_ENV: zod_1.z
        .enum(["development", "production", "test"])
        .default("development"),
    ANTHROPIC_API_KEY: zod_1.z.string().min(1, "ANTHROPIC_API_KEY is required"),
});
const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment variables:", zod_1.z.treeifyError(parsed.error));
    process.exit(1);
}
const config = {
    apiPort: parsed.data.API_PORT,
    socketPort: parsed.data.SOCKET_PORT,
    clientUrl: parsed.data.CLIENT_URL,
    nodeEnv: parsed.data.NODE_ENV,
    anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
};
exports.default = config;
