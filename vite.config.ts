import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        name: "Prime F&H",
        short_name: "Prime",
        description: "Tu centro de entrenamiento y kinesiología en Puerto Montt",
        lang: "es",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#3D9AA6",
        background_color: "#070A12",
        categories: ["health", "fitness"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Sin runtimeCaching: la app nunca usó Supabase (config muerta, de un
        // scaffold anterior) y api.primefh.cl no debe cachearse — son datos
        // de salud (PHI), nunca en el cache del service worker (Paso 26).
      },
      devOptions: {
        enabled: true, // permite testear PWA en desarrollo
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

