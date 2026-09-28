import dotenv from "dotenv";
dotenv.config();

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://10.0.2.2:3000",
  "http://192.168.0.7:3000",
  "http://192.168.0.7:8081",
  "exp://10.0.2.2:8081",
  "exp://192.168.0.7:8081",
  "https://capstone-diponeocare-production.up.railway.app",
];

export const env = {
  AI_SERVER_URL: process.env.AI_SERVER_URL || "",
  DEVICE_OFFLINE_AFTER_SEC: Number(
    process.env.DEVICE_OFFLINE_AFTER_SEC || "90",
  ),
  PORT: process.env.PORT || "3000",
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET || "fallback_secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ALLOWED_ORIGINS: (
    process.env.ALLOWED_ORIGINS || defaultAllowedOrigins.join(",")
  ).split(","),
} as const;
