import express from "express";
import cors from "cors";
import path from "node:path";
import sanctionsCheck from "./routes/sanctions-check";
import sanctionsCrypto from "./routes/sanctions-crypto";
import sanctionsLists from "./routes/sanctions-lists";
import sanctionsSync from "./routes/sanctions-sync";
import { startCronJobs } from "./cron";
import { initializeDatabaseSchema, waitForDatabase } from "../db";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/sanctions/check", sanctionsCheck);
app.use("/api/sanctions/crypto", sanctionsCrypto);
app.use("/api/sanctions/lists", sanctionsLists);
app.use("/api/sanctions/sync", sanctionsSync);

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

const clientDir = path.resolve(__dirname, "../client");

app.use(express.static(clientDir));
app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
});

const PORT = Number(process.env.PORT ?? 3000);

async function main() {
    await waitForDatabase();
    await initializeDatabaseSchema();
    startCronJobs();

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}

main().catch((error) => {
    console.error("Server failed to start:", error);
    process.exit(1);
});
