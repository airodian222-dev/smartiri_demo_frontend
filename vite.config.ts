import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// In development (and `vite preview`), API calls are proxied so the browser
// does not hit CORS restrictions when the console uses same-origin URLs:
//   /api/...                 -> chirpstack-rest-api   (CHIRPSTACK_REST_URL)
//   /api.InternalService/... -> ChirpStack gRPC-web   (CHIRPSTACK_GRPC_URL)
// Configure them in .env.local (see .env.example).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rest = env.CHIRPSTACK_REST_URL || "http://localhost:8090";
  const grpc = env.CHIRPSTACK_GRPC_URL || "http://localhost:8080";
  const proxy = {
    // Trailing slash matters: "/api" alone would also capture the /api-keys page.
    "/api/": { target: rest, changeOrigin: true },
    "^/api\\.\\w+Service/": { target: grpc, changeOrigin: true },
  };
  return {
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
            charts: ["recharts"],
            map: ["leaflet", "react-leaflet"],
          },
        },
      },
    },
  };
});
