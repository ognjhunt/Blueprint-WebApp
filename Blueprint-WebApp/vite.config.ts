import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import { VitePWA } from 'vite-plugin-pwa'; // Import VitePWA

const __dirname = import.meta.dirname;

export default defineConfig({
  plugins: [
    react(),
    checker({ typescript: true, overlay: false }),
    runtimeErrorOverlay(),
    themePlugin(),
        ViteImageOptimizer({ // Add the plugin configuration
          png: {
            quality: 80,
          },
          jpeg: {
            quality: 80,
          },
          jpg: {
            quality: 80,
          },
          webp: {
            quality: 80,
          },
          avif: { // Also consider AVIF if browser support is sufficient for your target
            quality: 70,
          },
        }),
        VitePWA({ // Add VitePWA configuration
          registerType: 'autoUpdate', // Automatically update the SW when new content is available
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'gradientBPLogo.ico'], // Cache these specific assets from the public folder
          manifest: { // Basic manifest for PWA capabilities
            name: 'Blueprint',
            short_name: 'Blueprint',
            description: 'Blueprint AR Platform',
            theme_color: '#ffffff',
            icons: [
              {
                src: 'pwa-192x192.png', // You'll need to add these icons to client/public
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'pwa-512x512.png', // You'll need to add these icons to client/public
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          },
          workbox: { // Workbox configuration for caching strategies
            globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff,woff2}'], // Cache common static assets
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /\.(?:png|gif|jpg|jpeg|svg|webp|avif)$/, // Cache images
                handler: 'StaleWhileRevalidate', // Serve from cache, update in background
                options: {
                  cacheName: 'image-cache',
                  expiration: {
                    maxEntries: 60,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // <== 30 days
                  }
                }
              }
            ]
          },
          devOptions: { // Enable PWA plugin in development for testing
            enabled: true,
            type: 'module', // Use module type for SW in dev
          }
        })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@db": path.resolve(__dirname, "db"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
