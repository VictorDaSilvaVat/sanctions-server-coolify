"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../../db");
const schema_1 = require("../../db/schema");
const router = (0, express_1.Router)();
function parsePrograms(value) {
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
        const rawAddress = String(req.query.address ?? "").trim();
        const network = String(req.query.network ?? "").trim().toUpperCase();
        if (!rawAddress) {
            return res.status(400).json({ error: "Missing address query parameter" });
        }
        const address = rawAddress.replace(/^0x/i, "");
        const addressWithPrefix = rawAddress.startsWith("0x")
            ? rawAddress
            : `0x${rawAddress}`;
        const addressFilter = (0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.sanctionsCryptoAddresses.address, address), (0, drizzle_orm_1.ilike)(schema_1.sanctionsCryptoAddresses.address, addressWithPrefix), (0, drizzle_orm_1.ilike)(schema_1.sanctionsCryptoAddresses.address, `%${address}%`));
        const whereClause = network
            ? (0, drizzle_orm_1.and)(addressFilter, (0, drizzle_orm_1.eq)(schema_1.sanctionsCryptoAddresses.network, network))
            : addressFilter;
        const rows = await db_1.db
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
            .where(whereClause)
            .limit(20);
        const matches = rows.map((row) => ({
            ...row,
            programs: parsePrograms(row.programs),
        }));
        res.json({
            sanctioned: matches.length > 0,
            address: rawAddress,
            network: network || null,
            matches,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal error" });
    }
});
exports.default = router;
