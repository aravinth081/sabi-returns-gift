import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("firebase")) {
              return "vendor-firebase";
            }
            if (id.includes("recharts") || id.includes("d3-")) {
              return "vendor-recharts";
            }
            if (id.includes("xlsx")) {
              return "vendor-xlsx";
            }
            if (id.includes("html2canvas")) {
              return "vendor-html2canvas";
            }
            if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("cmdk") || id.includes("sonner")) {
              return "vendor-ui";
            }
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom") || id.includes("@tanstack")) {
              return "vendor-framework";
            }
          }
        },
      },
    },
  },
}));
