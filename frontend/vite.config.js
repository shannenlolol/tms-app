import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";


export default defineConfig({
  plugins: [react()],     // <-- enables the automatic runtime
  server: {
    https: {
      key: fs.readFileSync(path.resolve("../backend/certs/localhost+2-key.pem")),
      cert: fs.readFileSync(path.resolve("../backend/certs/localhost+2.pem")),
    },
    port: 5173,
    // (optional) proxy API so it's same-origin at https://localhost:5173
    proxy: {
      "/api": {
        target: "https://localhost:3000",
        changeOrigin: true,
        secure: false, // backend uses dev cert
      },
    },
  },
});
