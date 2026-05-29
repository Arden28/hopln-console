import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Explicit base for Vercel (root deploy)
  base: "/",
  build: { outDir: "dist" },
  server: {
    host: true,       // bind to 0.0.0.0 (also fixes some WSL/host issues)
    port: 5173,
    strictPort: false
  },
});
