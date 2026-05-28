"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../../db");
const schema_1 = require("../../db/schema");
const router = (0, express_1.Router)();
function parseJsonArray(value) {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
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
            ? await db_1.db
                .select({
                id: schema_1.sanctionsEntities.id,
                sdnId: schema_1.sanctionsEntities.sdnId,
                name: schema_1.sanctionsEntities.name,
                aliases: schema_1.sanctionsEntities.aliases,
                entityType: schema_1.sanctionsEntities.entityType,
                programs: schema_1.sanctionsEntities.programs,
                country: schema_1.sanctionsEntities.country,
                remarks: schema_1.sanctionsEntities.remarks,
                listName: schema_1.sanctionsLists.name,
            })
                .from(schema_1.sanctionsEntities)
                .innerJoin(schema_1.sanctionsLists, (0, drizzle_orm_1.eq)(schema_1.sanctionsEntities.listId, schema_1.sanctionsLists.id))
                .where(type === "id"
                ? (0, drizzle_orm_1.ilike)(schema_1.sanctionsEntities.sdnId, `%${query}%`)
                : (0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.sanctionsEntities.name, `%${query}%`), (0, drizzle_orm_1.ilike)(schema_1.sanctionsEntities.aliases, `%${query}%`)))
                .limit(limit)
            : [];
        const cryptoRows = searchCrypto
            ? await db_1.db
                .select({
                id: schema_1.sanctionsCryptoAddresses.id,
                address: schema_1.sanctionsCryptoAddresses.address,
                network: schema_1.sanctionsCryptoAddresses.network,
                entityName: schema_1.sanctionsCryptoAddresses.entityName,
                sdnId: schema_1.sanctionsCryptoAddresses.sdnId,
                programs: schema_1.sanctionsCryptoAddresses.programs,
                listName: schema_1.sanctionsLists.name,
            })
                .from(schema_1.sanctionsCryptoAddresses)
                .innerJoin(schema_1.sanctionsLists, (0, drizzle_orm_1.eq)(schema_1.sanctionsCryptoAddresses.listId, schema_1.sanctionsLists.id))
                .where(type === "id"
                ? (0, drizzle_orm_1.ilike)(schema_1.sanctionsCryptoAddresses.sdnId, `%${query}%`)
                : (0, drizzle_orm_1.ilike)(schema_1.sanctionsCryptoAddresses.address, `%${query.replace(/^0x/i, "")}%`))
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal error" });
    }
});
exports.default = router;
