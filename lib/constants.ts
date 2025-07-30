// lib/constants.ts

// Make sure you have EXPO_PUBLIC_BACKEND_API_URL in your .env file
export const BACKEND_API_URL = process.env.EXPO_PUBLIC_BACKEND_API_URL;

if (!BACKEND_API_URL) {
  console.warn('⚠️ Missing EXPO_PUBLIC_BACKEND_API_URL in .env');
}
