"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_path_1 = __importDefault(require("node:path"));
const sanctions_check_1 = __importDefault(require("./routes/sanctions-check"));
const sanctions_crypto_1 = __importDefault(require("./routes/sanctions-crypto"));
const sanctions_lists_1 = __importDefault(require("./routes/sanctions-lists"));
const sanctions_sync_1 = __importDefault(require("./routes/sanctions-sync"));
const cron_1 = require("./cron");
const db_1 = require("../db");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/api/sanctions/check", sanctions_check_1.default);
app.use("/api/sanctions/crypto", sanctions_crypto_1.default);
app.use("/api/sanctions/lists", sanctions_lists_1.default);
app.use("/api/sanctions/sync", sanctions_sync_1.default);
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
const clientDir = node_path_1.default.resolve(__dirname, "../client");
app.use(express_1.default.static(clientDir));
app.get("*", (_req, res) => {
    res.sendFile(node_path_1.default.join(clientDir, "index.html"));
});
const PORT = Number(process.env.PORT ?? 3000);
async function main() {
    await (0, db_1.waitForDatabase)();
    await (0, db_1.initializeDatabaseSchema)();
    (0, cron_1.startCronJobs)();
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}
main().catch((error) => {
    console.error("Server failed to start:", error);
    process.exit(1);
});
