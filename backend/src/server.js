// backend/src/server.js
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";
import { app } from "./app.js";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// Default to your certs; allow overriding via env
const KEY_PATH  = process.env.SSL_KEY_FILE || path.join(__dirname, "../certs/localhost+2-key.pem");
const CERT_PATH = process.env.SSL_CRT_FILE || path.join(__dirname, "../certs/localhost+2.pem");


if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
  const key  = fs.readFileSync(KEY_PATH);
  const cert = fs.readFileSync(CERT_PATH);

  https.createServer({ key, cert }, app).listen(PORT, () => {
    console.log(`HTTPS server running at https://localhost:${PORT}`);
  });
} else {
  console.warn("SSL certs not found, falling back to HTTP.");
  http.createServer(app).listen(PORT, () => {
    console.log(`HTTP server running at http://localhost:${PORT}`);
  });
}
