"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sync_1 = require("../lib/sync");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
        return res.status(401).json({ success: false, error: "Unauthorized: Invalid or missing admin password." });
    }
    const listFilter = typeof req.query.list === "string" ? req.query.list : undefined;
    console.log(`Starting sanctions sync${listFilter ? ` for list: ${listFilter}` : " for all lists"}`);
    try {
        const results = await (0, sync_1.runFullSync)(listFilter);
        const allSuccess = results.every((result) => result.status === "success");
        res.status(allSuccess ? 200 : 207).json({
            success: allSuccess,
            results,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const cause = error instanceof Error ? error.cause : undefined;
        console.error("sanctions-sync error:", message, cause ?? "");
        res.status(500).json({
            success: false,
            error: message,
            cause: cause instanceof Error ? cause.message : undefined,
            timestamp: new Date().toISOString(),
        });
    }
});
exports.default = router;
