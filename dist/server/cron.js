"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = startCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const sync_1 = require("./lib/sync");
function startCronJobs() {
    node_cron_1.default.schedule("0 2 * * 0", async () => {
        console.log("Running sanctions sync...");
        try {
            const results = await (0, sync_1.runFullSync)();
            console.log("Scheduled sanctions sync complete:", JSON.stringify(results));
        }
        catch (error) {
            console.error("Scheduled sanctions sync failed:", error);
        }
    });
}
