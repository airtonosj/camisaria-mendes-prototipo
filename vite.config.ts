import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The Node app serves at the origin root, including direct nested URLs.
  base: "/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173,
  },
});
