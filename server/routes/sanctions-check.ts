import { Router } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db } from "../../db";
import {
    sanctionsCryptoAddresses,
    sanctionsEntities,
    sanctionsLists,
} from "../../db/schema";

const router = Router();

function parseJsonArray(value: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

router.get("/", async (req, res) => {
    try {
        const query = String(req.query.q ?? "").trim();
        const type = String(req.query.type ?? "all").trim().toLowerCase();
        const rawLimit = Number(req.query.limit ?? 50);
        const limit = Number.isFinite(rawLimit)
            ? Math.max(1, Math.min(rawLimit, 200))
            : 50;

        if (query.length < 2) {
            return res.status(400).json({ error: "Query must be at least 2 characters" });
        }

        const searchCrypto = type === "all" || type === "crypto" || type === "id";
        const searchEntities = type === "all" || type === "name" || type === "id";

        const entityRows = searchEntities
            ? await db
                  .select({
                      id: sanctionsEntities.id,
                      sdnId: sanctionsEntities.sdnId,
                      name: sanctionsEntities.name,
                      aliases: sanctionsEntities.aliases,
                      entityType: sanctionsEntities.entityType,
                      programs: sanctionsEntities.programs,
                      country: sanctionsEntities.country,
                      remarks: sanctionsEntities.remarks,
                      listName: sanctionsLists.name,
                  })
                  .from(sanctionsEntities)
                  .innerJoin(sanctionsLists, eq(sanctionsEntities.listId, sanctionsLists.id))
                  .where(
                      type === "id"
                          ? or(
                                ilike(sanctionsEntities.sdnId, `%${query}%`),
                                ilike(sanctionsEntities.remarks, `%${query}%`),
                            )
                          : or(
                                ilike(sanctionsEntities.name, `%${query}%`),
                                ilike(sanctionsEntities.aliases, `%${query}%`),
                            ),
                  )
                  .limit(limit)
            : [];

        const cryptoRows = searchCrypto
            ? await db
                  .select({
                      id: sanctionsCryptoAddresses.id,
                      address: sanctionsCryptoAddresses.address,
                      network: sanctionsCryptoAddresses.network,
                      entityName: sanctionsCryptoAddresses.entityName,
                      sdnId: sanctionsCryptoAddresses.sdnId,
                      programs: sanctionsCryptoAddresses.programs,
                      listName: sanctionsLists.name,
                  })
                  .from(sanctionsCryptoAddresses)
                  .innerJoin(
                      sanctionsLists,
                      eq(sanctionsCryptoAddresses.listId, sanctionsLists.id),
                  )
                  .where(
                      type === "id"
                          ? ilike(sanctionsCryptoAddresses.sdnId, `%${query}%`)
                          : ilike(
                                sanctionsCryptoAddresses.address,
                                `%${query.replace(/^0x/i, "")}%`,
                            ),
                  )
                  .limit(limit)
            : [];

        const entityMatches = entityRows.map((row) => ({
            ...row,
            aliases: parseJsonArray(row.aliases),
            entityType: row.entityType ?? "entity",
            programs: parseJsonArray(row.programs),
        }));

        const cryptoMatches = cryptoRows.map((row) => ({
            ...row,
            programs: parseJsonArray(row.programs),
        }));

        res.json({
            match: entityMatches.length > 0 || cryptoMatches.length > 0,
            query,
            type,
            entityMatches,
            cryptoMatches,
            totalMatches: entityMatches.length + cryptoMatches.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal error" });
    }
});

export default router;
