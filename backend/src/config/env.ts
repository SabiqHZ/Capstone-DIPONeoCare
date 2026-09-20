import dotenv from "dotenv";
dotenv.config();

export const env = {
  AI_SERVER_URL: process.env.AI_SERVER_URL || "",
  AI_SERVER_API_KEY: process.env.AI_SERVER_API_KEY || "",
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
    process.env.ALLOWED_ORIGINS ||
    "http://localhost:3000,http://127.0.0.1:3000,http://10.0.2.2:3000,http://192.168.1.15:3000,http://192.168.1.15:8081"
  ).split(","),
} as const;
