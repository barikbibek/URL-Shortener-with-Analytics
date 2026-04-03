import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // This allows us to import from "@/components/..." instead of
    // "../../components/..." — cleaner imports throughout the app
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the backend during local dev (npm run dev)
    // so you don't get CORS errors. In production, Nginx handles this.
    proxy: {
      "/api": "http://localhost",
      "/r": "http://localhost",
    },
  },
});