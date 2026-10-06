import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    // El frontend importa tauri.conf.json para mostrar el nombre oficial.
    watch: { ignored: ["**/src-tauri/target/**", "**/src-tauri/gen/**"] },
  },
});
