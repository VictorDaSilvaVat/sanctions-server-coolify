import cron from "node-cron";
import { runFullSync } from "./lib/sync";

export function startCronJobs() {
    cron.schedule("0 2 * * 0", async () => {
        console.log("Running sanctions sync...");

        try {
            const results = await runFullSync();
            console.log("Scheduled sanctions sync complete:", JSON.stringify(results));
        } catch (error) {
            console.error("Scheduled sanctions sync failed:", error);
        }
    });
}
