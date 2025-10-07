import http from "http";
import { app } from "./app.js";
import "dotenv/config";        // <-- loads backend/.env

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

    