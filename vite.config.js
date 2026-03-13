import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      allowedHosts: ["granth.tail1a6e05.ts.net"],
      proxy: {
        // Proxy /api calls to a local Express server during dev
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
    define: {
      // Make env vars available if needed
      "import.meta.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL || ""),
    },
  };
});
