import http from "http";
import { app } from "./app.js";
import "dotenv/config";        // <-- loads backend/.env

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));


// // src/server.js
// import "dotenv/config";
// import fs from "fs";
// import https from "https";
// import { app } from "./app.js";

// const PORT = process.env.PORT || 3000;
// const key  = fs.readFileSync("./certs/localhost-key.pem");
// const cert = fs.readFileSync("./certs/localhost-cert.pem");

// https.createServer({ key, cert }, app).listen(PORT, () => {
//   console.log(`Server started on https://localhost:${PORT}`);
// });
