// js/config.js
// ================================
// 🔧 Configuration file for PrintQ
// ================================

// Your Supabase project URL
export const SUPABASE_URL = "https://gtmchmkgjtsowgwrasye.supabase.co";

// Your Supabase anon/public key
// 📍 Found in Supabase → Project Settings → API → Project API Keys
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0bWNobWtnanRzb3dnd3Jhc3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzIwNjgsImV4cCI6MjA3NTg0ODA2OH0.DHjs_utI3w-edQlx70cSETjKdHYk6N6rUCG-B_wrEzo";

// Your PayMongo test secret key
// 📍 Starts with "sk_test_..." (use TEST mode only)
export const PAYMONGO_SECRET = "sk_test_PzqVfX7X6SjuvJ7Fgm9hnNLu";

// The base URL for Supabase Edge Functions (only used for createPrint)
export const API_BASE = `${SUPABASE_URL}/functions/v1`;
