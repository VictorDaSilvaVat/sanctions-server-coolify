"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../../db");
const schema_1 = require("../../db/schema");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    try {
        const lists = await db_1.db
            .select()
            .from(schema_1.sanctionsLists)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.sanctionsLists.updatedAt));
        const totalEntities = lists.reduce((sum, list) => sum + (list.entityCount ?? 0), 0);
        const totalAddresses = lists.reduce((sum, list) => sum + (list.addressCount ?? 0), 0);
        const activeLists = lists.filter((list) => list.status === "active").length;
        res.json({
            totalEntities,
            totalAddresses,
            activeLists,
            lists,
        });
    }
    catch (error) {
        const cause = error instanceof Error ? error.cause : undefined;
        console.error("sanctions-lists error:", error, cause ?? "");
        res.status(500).json({
            error: "Internal error",
            cause: cause instanceof Error ? cause.message : undefined,
        });
    }
});
exports.default = router;
