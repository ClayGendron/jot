import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  publicDir: resolve(__dirname, "../.."), // Serve fixtures from project root
  server: {
    port: 5174, // Different port from main app
    open: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "../../src"),
    },
  },
});
