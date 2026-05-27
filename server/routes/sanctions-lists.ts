import { Router } from "express";
import { desc } from "drizzle-orm";
import { db } from "../../db";
import { sanctionsLists } from "../../db/schema";

const router = Router();

router.get("/", async (_req, res) => {
    try {
        const lists = await db
            .select()
            .from(sanctionsLists)
            .orderBy(desc(sanctionsLists.updatedAt));

        const totalEntities = lists.reduce(
            (sum, list) => sum + (list.entityCount ?? 0),
            0,
        );
        const totalAddresses = lists.reduce(
            (sum, list) => sum + (list.addressCount ?? 0),
            0,
        );
        const activeLists = lists.filter((list) => list.status === "active").length;

        res.json({
            totalEntities,
            totalAddresses,
            activeLists,
            lists,
        });
    } catch (error) {
        const cause = error instanceof Error ? error.cause : undefined;
        console.error("sanctions-lists error:", error, cause ?? "");
        res.status(500).json({
            error: "Internal error",
            cause: cause instanceof Error ? cause.message : undefined,
        });
    }
});

export default router;
