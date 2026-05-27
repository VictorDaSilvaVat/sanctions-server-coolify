"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIVATE_LISTS = void 0;
exports.syncPrivateCsvList = syncPrivateCsvList;
exports.privateListSource = privateListSource;
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const sync_1 = require("csv-parse/sync");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../../db");
const schema_1 = require("../../db/schema");
const PRIVATE_LISTS_DIR = process.env.PRIVATE_LISTS_DIR || "/app/private-lists";
exports.PRIVATE_LISTS = [
    {
        name: "Private Extremistas",
        fileName: "extremistas.csv",
        description: "Private extremist groups crypto intelligence list",
        parser: parseExtremistas,
    },
    {
        name: "WSL",
        fileName: "wsl.csv",
        description: "Private WSL crypto intelligence list",
        parser: parseExtremistas,
    },
    {
        name: "Private Scams",
        fileName: "scams.csv",
        description: "Private scams intelligence list",
        parser: parseScams,
    },
    {
        name: "Private Malware",
        fileName: "malware.csv",
        description: "Private malware crypto intelligence list",
        parser: parseRiskWalletList("Private Malware"),
    },
    {
        name: "Private Hackers",
        fileName: "hackers.csv",
        description: "Private hackers crypto intelligence list",
        parser: parseRiskWalletList("Private Hackers"),
    },
];
function clean(value) {
    return String(value ?? "").trim();
}
function json(values) {
    return JSON.stringify([...new Set(values.map(clean).filter(Boolean))]);
}
function readCsvRows(content) {
    return (0, sync_1.parse)(content.replace(/^\uFEFF/, ""), {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true,
        trim: true,
    });
}
function makeEntity(listId, key, name, entityType, aliases, programs, country, remarks) {
    return {
        listId,
        sdnId: key || null,
        name: name || "Unknown",
        aliases: json(aliases),
        entityType,
        programs: json(programs),
        country,
        remarks,
    };
}
function parseExtremistas(rows, listId) {
    const entities = [];
    const crypto = [];
    for (const row of rows) {
        const key = clean(row.ID || row.id);
        const name = clean(row.ORGANIZACION);
        const network = clean(row.CRIPTOMONEDA).toUpperCase();
        const addressRaw = clean(row.DIRECCION);
        const addresses = addressRaw ? parseJsonishArray(addressRaw) : [];
        const program = clean(row.ORG) || "Grupo Extremista";
        const remarks = [clean(row.LINK), clean(row.ACERCA_ORGANIZACION)]
            .filter(Boolean)
            .join(" | ");
        if (!name && addresses.length === 0)
            continue;
        const mainAddress = addresses[0] || "";
        entities.push(makeEntity(listId, key || mainAddress, name || mainAddress, "entity", [], [program], null, remarks || null));
        for (const addr of addresses) {
            crypto.push({
                entityKey: key || mainAddress,
                listId,
                address: addr,
                network: network || detectCryptoNetwork(addr),
                sdnId: key || null,
                entityName: name || null,
                programs: json([program]),
            });
        }
    }
    return { entities, crypto };
}
function parseJsonishArray(value) {
    const text = clean(value);
    if (!text)
        return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed))
            return parsed.map(clean).filter(Boolean);
        if (typeof parsed === "string")
            return [parsed].map(clean).filter(Boolean);
    }
    catch {
        // Some private CSVs use semicolon or pipe separated values.
    }
    return text
        .split(/[|;,]/)
        .map(clean)
        .filter(Boolean);
}
function detectCryptoNetwork(address) {
    if (/^T[A-Za-z0-9]{33}$/.test(address))
        return "TRX";
    if (/^0x[a-fA-F0-9]{40}$/.test(address))
        return "ETH";
    if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/i.test(address))
        return "BTC";
    if (/^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(address))
        return "LTC";
    if (/^X[1-9A-HJ-NP-Za-km-z]{33}$/.test(address))
        return "DASH";
    return "UNKNOWN";
}
function allWalletCandidates(...values) {
    const addresses = [];
    for (const value of values) {
        const candidates = parseJsonishArray(value);
        for (const candidate of candidates) {
            if (candidate.length >= 20) {
                addresses.push(candidate);
            }
        }
    }
    return [...new Set(addresses)];
}
function parseScams(rows, listId) {
    const entities = [];
    const crypto = [];
    for (const row of rows) {
        const key = clean(row.id);
        const name = clean(row.name) || clean(row.aliases) || key;
        const schema = clean(row.schema).toLowerCase();
        if (!name)
            continue;
        const programs = [
            clean(row.dataset),
            clean(row.program_ids),
            clean(row.sanctions),
        ].filter(Boolean);
        entities.push(makeEntity(listId, key || name, name, schema === "cryptowallet" ? "entity" : schema || "entity", parseJsonishArray(row.aliases), programs, parseJsonishArray(row.countries)[0] ?? null, [
            clean(row.addresses),
            clean(row.identifiers),
            clean(row.phones),
            clean(row.emails),
            clean(row.first_seen),
            clean(row.last_seen),
            clean(row.last_change),
        ]
            .filter(Boolean)
            .join(" | ") || null));
        if (schema === "cryptowallet") {
            const addresses = allWalletCandidates(row.name, row.identifiers, row.addresses);
            for (const address of addresses) {
                crypto.push({
                    entityKey: key || name,
                    listId,
                    address,
                    network: detectCryptoNetwork(address),
                    sdnId: key || null,
                    entityName: clean(row.aliases) || name,
                    programs: json(programs),
                });
            }
        }
    }
    return { entities, crypto };
}
function parseRiskWalletList(program) {
    return (rows, listId) => {
        const entities = [];
        const crypto = [];
        for (const row of rows) {
            const addressRaw = clean(row.Address);
            const addresses = parseJsonishArray(addressRaw);
            const name = clean(row["Name Tag"]) ||
                clean(row.Wallet_Name) ||
                clean(row.Classification) ||
                addresses[0] || "";
            const network = clean(row.Crypto).toUpperCase();
            const key = addresses[0] || name;
            if (!key)
                continue;
            const programs = [
                program,
                clean(row["Risk Type"]),
                clean(row["Risk Level"]),
                clean(row.Wallet_Class),
                clean(row.sanctions),
            ].filter(Boolean);
            entities.push(makeEntity(listId, key, name, "entity", [clean(row.Classification), clean(row.Wallet_Name)].filter(Boolean), programs, clean(row.Country) || null, [clean(row.Info), clean(row.Balance), clean(row.RiskPor)]
                .filter(Boolean)
                .join(" | ") || null));
            for (const address of addresses) {
                crypto.push({
                    entityKey: key,
                    listId,
                    address,
                    network: network || detectCryptoNetwork(address),
                    sdnId: key,
                    entityName: name,
                    programs: json(programs),
                });
            }
        }
        return { entities, crypto };
    };
}
async function syncPrivateCsvList(config, listId) {
    const filePath = node_path_1.default.join(PRIVATE_LISTS_DIR, config.fileName);
    if (!(0, node_fs_1.existsSync)(filePath)) {
        throw new Error(`Private CSV not found: ${filePath}`);
    }
    const rows = readCsvRows(await (0, promises_1.readFile)(filePath, "utf8"));
    const parsed = config.parser(rows, listId);
    await db_1.db.execute((0, drizzle_orm_1.sql) `
        DELETE FROM sanctions_crypto_addresses
        WHERE list_id = ${listId}
           OR entity_id IN (
                SELECT id FROM sanctions_entities WHERE list_id = ${listId}
           )
    `);
    await db_1.db.delete(schema_1.sanctionsEntities).where((0, drizzle_orm_1.eq)(schema_1.sanctionsEntities.listId, listId));
    let entityCount = 0;
    let addressCount = 0;
    const entityKeyToId = {};
    const batchSize = 200;
    for (let i = 0; i < parsed.entities.length; i += batchSize) {
        const batch = parsed.entities.slice(i, i + batchSize);
        if (batch.length === 0)
            continue;
        const inserted = await db_1.db
            .insert(schema_1.sanctionsEntities)
            .values(batch)
            .returning({ id: schema_1.sanctionsEntities.id, sdnId: schema_1.sanctionsEntities.sdnId });
        entityCount += inserted.length;
        for (const entity of inserted) {
            if (entity.sdnId)
                entityKeyToId[entity.sdnId] = entity.id;
        }
    }
    for (let i = 0; i < parsed.crypto.length; i += batchSize) {
        const batch = parsed.crypto.slice(i, i + batchSize).map(({ entityKey, ...row }) => ({
            ...row,
            entityId: entityKeyToId[entityKey] ?? null,
        }));
        if (batch.length === 0)
            continue;
        const inserted = await db_1.db
            .insert(schema_1.sanctionsCryptoAddresses)
            .values(batch)
            .onConflictDoNothing()
            .returning({ id: schema_1.sanctionsCryptoAddresses.id });
        addressCount += inserted.length;
    }
    return { entityCount, addressCount };
}
function privateListSource(config) {
    return `private://${config.fileName}`;
}
