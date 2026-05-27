import { Router } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db";
import { sanctionsCryptoAddresses, sanctionsLists } from "../../db/schema";

const router = Router();

function parsePrograms(value: string | null): string[] {
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
        const rawAddress = String(req.query.address ?? "").trim();
        const network = String(req.query.network ?? "").trim().toUpperCase();

        if (!rawAddress) {
            return res.status(400).json({ error: "Missing address query parameter" });
        }

        const address = rawAddress.replace(/^0x/i, "");
        const addressWithPrefix = rawAddress.startsWith("0x")
            ? rawAddress
            : `0x${rawAddress}`;
        const addressFilter = or(
            ilike(sanctionsCryptoAddresses.address, address),
            ilike(sanctionsCryptoAddresses.address, addressWithPrefix),
            ilike(sanctionsCryptoAddresses.address, `%${address}%`),
        );
        const whereClause = network
            ? and(addressFilter, eq(sanctionsCryptoAddresses.network, network))
            : addressFilter;

        const rows = await db
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal error" });
    }
});

export default router;
