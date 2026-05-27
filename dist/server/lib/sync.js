"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureListRecords = ensureListRecords;
exports.syncOFACSDN = syncOFACSDN;
exports.syncOfacConsolidated = syncOfacConsolidated;
exports.syncUNConsolidated = syncUNConsolidated;
exports.syncEUConsolidated = syncEUConsolidated;
exports.runFullSync = runFullSync;
const fast_xml_parser_1 = require("fast-xml-parser");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../../db");
const schema_1 = require("../../db/schema");
const private_csv_sync_1 = require("./private-csv-sync");
const CRYPTO_NETWORK_MAP = {
    "Digital Currency Address - XBT": "BTC",
    "Digital Currency Address - ETH": "ETH",
    "Digital Currency Address - XMR": "XMR",
    "Digital Currency Address - LTC": "LTC",
    "Digital Currency Address - ZEC": "ZEC",
    "Digital Currency Address - DASH": "DASH",
    "Digital Currency Address - BTG": "BTG",
    "Digital Currency Address - ETC": "ETC",
    "Digital Currency Address - BSV": "BSV",
    "Digital Currency Address - BCH": "BCH",
    "Digital Currency Address - XRP": "XRP",
    "Digital Currency Address - TRX": "TRX",
    "Digital Currency Address - USDT": "USDT",
    "Digital Currency Address - USDC": "USDC",
    "Digital Currency Address - ARB": "ARB",
    "Digital Currency Address - XLM": "XLM",
    "Digital Currency Address - SOL": "SOL",
    "Digital Currency Address - BNB": "BNB",
    "Digital Currency Address - MATIC": "MATIC",
    "Digital Currency Address - AVAX": "AVAX",
    "Digital Currency Address - ADA": "ADA",
};
let syncInProgress = false;
function toArray(val) {
    if (val == null)
        return [];
    return Array.isArray(val) ? val : [val];
}
const FETCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 sanctions-server-coolify/1.0 (+https://github.com/)",
    Accept: "application/xml,text/xml,application/json,text/plain,*/*",
};
const OPEN_SANCTIONS_DATASETS = [
    {
        name: "PEP OpenSanctions",
        slug: "peps",
        fallbackSlugs: ["wd_peps"],
        description: "Politically exposed persons collection from OpenSanctions",
    },
    {
        name: "IL NBCTF",
        slug: "il_nbctf",
        fallbackSlugs: ["il_mod_crypto", "il_mod_terrorists"],
        description: "Israel National Bureau for Counter Terror Financing sanctions and seizure",
    },
    {
        name: "JP MOF",
        slug: "jp_mof_sanctions",
        description: "Japan Ministry of Finance sanctions list",
    },
    {
        name: "GB OFSI",
        slug: "gb_fcdo_sanctions",
        description: "United Kingdom financial sanctions list maintained by OFSI/FCDO",
    },
    {
        name: "CH SECO",
        slug: "ch_seco_sanctions",
        description: "Swiss SECO sanctions list",
    },
    {
        name: "EU FSF",
        slug: "eu_fsf",
        description: "European Union Financial Sanctions Files",
    },
    {
        name: "FR DG Tresor",
        slug: "fr_tresor_gels_avoir",
        description: "French Directorate General of the Treasury asset freeze list",
    },
    {
        name: "AU DFAT",
        slug: "au_dfat_sanctions",
        description: "Australian DFAT consolidated sanctions list",
    },
    {
        name: "CA GAC",
        slug: "ca_dfatd_sema_sanctions",
        description: "Global Affairs Canada sanctions list",
    },
];
function openSanctionsUrl(slug) {
    return `https://data.opensanctions.org/datasets/latest/${slug}/entities.ftm.json`;
}
async function clearListData(listId) {
    await db_1.db.execute((0, drizzle_orm_1.sql) `
        DELETE FROM sanctions_crypto_addresses
        WHERE list_id = ${listId}
           OR entity_id IN (
                SELECT id FROM sanctions_entities WHERE list_id = ${listId}
           )
    `);
    await db_1.db.delete(schema_1.sanctionsEntities).where((0, drizzle_orm_1.eq)(schema_1.sanctionsEntities.listId, listId));
}
async function ensureListRecords() {
    const seeds = [
        {
            name: "OFAC SDN",
            source: "https://www.treasury.gov/ofac/downloads/sdn.xml",
            description: "US Treasury OFAC Specially Designated Nationals and Blocked Persons List",
        },
        {
            name: "OFAC Consolidated",
            source: "https://www.treasury.gov/ofac/downloads/consolidated/consolidated.xml",
            description: "US Treasury OFAC Consolidated Sanctions List",
        },
        {
            name: "UN Consolidated",
            source: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
            description: "United Nations Security Council Consolidated Sanctions List",
        },
        {
            name: "EU Consolidated",
            source: openSanctionsUrl("eu_fsf"),
            description: "European Union Financial Sanctions Files (CFSP)",
        },
        ...OPEN_SANCTIONS_DATASETS.map((dataset) => ({
            name: dataset.name,
            source: openSanctionsUrl(dataset.slug),
            description: dataset.description,
        })),
        ...private_csv_sync_1.PRIVATE_LISTS.map((list) => ({
            name: list.name,
            source: (0, private_csv_sync_1.privateListSource)(list),
            description: list.description,
        })),
    ];
    const map = {};
    for (const seed of seeds) {
        const existing = await db_1.db
            .select({ id: schema_1.sanctionsLists.id })
            .from(schema_1.sanctionsLists)
            .where((0, drizzle_orm_1.eq)(schema_1.sanctionsLists.name, seed.name))
            .limit(1);
        if (existing.length > 0) {
            await db_1.db
                .update(schema_1.sanctionsLists)
                .set({
                source: seed.source,
                description: seed.description,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.sanctionsLists.id, existing[0].id));
            map[seed.name] = existing[0].id;
        }
        else {
            const [row] = await db_1.db
                .insert(schema_1.sanctionsLists)
                .values(seed)
                .returning({ id: schema_1.sanctionsLists.id });
            map[seed.name] = row.id;
        }
    }
    return map;
}
async function syncOFACList(listId, url, label) {
    const response = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
        throw new Error(`${label} fetch failed: ${response.status} ${response.statusText}`);
    }
    const xml = await response.text();
    const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false, isArray: () => false });
    const parsed = parser.parse(xml);
    const entries = toArray(parsed?.sdnList?.sdnEntry);
    await clearListData(listId);
    let entityCount = 0;
    let addressCount = 0;
    const batchSize = 200;
    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const entityRows = [];
        for (const entry of batch) {
            const sdnId = String(entry.uid ?? "");
            const firstName = String(entry.firstName ?? "").trim();
            const lastName = String(entry.lastName ?? "").trim();
            const name = firstName ? `${firstName} ${lastName}` : lastName;
            const entityType = String(entry.sdnType ?? "entity").toLowerCase();
            const programs = toArray(entry.programList?.program).map(String);
            const aliases = toArray(entry.akaList?.aka)
                .map((aka) => {
                const fn = String(aka.firstName ?? "").trim();
                const ln = String(aka.lastName ?? "").trim();
                return fn ? `${fn} ${ln}` : ln;
            })
                .filter(Boolean);
            const addresses = toArray(entry.addressList?.address);
            const country = addresses[0]?.country ? String(addresses[0].country) : null;
            if (!name)
                continue;
            entityRows.push({
                listId,
                sdnId: sdnId || null,
                name,
                aliases: JSON.stringify(aliases),
                entityType,
                programs: JSON.stringify(programs),
                country,
                remarks: entry.remarks ? String(entry.remarks) : null,
            });
        }
        if (entityRows.length === 0)
            continue;
        const insertedEntities = await db_1.db
            .insert(schema_1.sanctionsEntities)
            .values(entityRows)
            .returning({ id: schema_1.sanctionsEntities.id, sdnId: schema_1.sanctionsEntities.sdnId });
        entityCount += insertedEntities.length;
        const sdnToEntityId = {};
        for (const entity of insertedEntities) {
            if (entity.sdnId)
                sdnToEntityId[entity.sdnId] = entity.id;
        }
        const cryptoRows = [];
        for (const entry of batch) {
            const sdnId = String(entry.uid ?? "");
            const firstName = String(entry.firstName ?? "").trim();
            const lastName = String(entry.lastName ?? "").trim();
            const entityName = firstName ? `${firstName} ${lastName}` : lastName;
            const programs = toArray(entry.programList?.program).map(String);
            const entityId = sdnId ? sdnToEntityId[sdnId] : undefined;
            for (const id of toArray(entry.idList?.id)) {
                const idType = String(id.idType ?? "");
                if (!idType.startsWith("Digital Currency Address"))
                    continue;
                const network = CRYPTO_NETWORK_MAP[idType] ??
                    idType.replace("Digital Currency Address - ", "").toUpperCase();
                const address = String(id.idNumber ?? "").trim();
                if (!address)
                    continue;
                cryptoRows.push({
                    listId,
                    entityId: entityId ?? null,
                    address,
                    network,
                    sdnId: sdnId || null,
                    entityName,
                    programs: JSON.stringify(programs),
                });
            }
        }
        if (cryptoRows.length > 0) {
            const inserted = await db_1.db
                .insert(schema_1.sanctionsCryptoAddresses)
                .values(cryptoRows)
                .onConflictDoNothing()
                .returning({ id: schema_1.sanctionsCryptoAddresses.id });
            addressCount += inserted.length;
        }
    }
    return { entityCount, addressCount };
}
function syncOFACSDN(listId) {
    return syncOFACList(listId, "https://www.treasury.gov/ofac/downloads/sdn.xml", "OFAC SDN");
}
function syncOfacConsolidated(listId) {
    return syncOFACList(listId, "https://www.treasury.gov/ofac/downloads/consolidated/consolidated.xml", "OFAC Consolidated");
}
async function syncUNConsolidated(listId) {
    const response = await fetch("https://scsanctions.un.org/resources/xml/en/consolidated.xml", {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
        throw new Error(`UN Consolidated fetch failed: ${response.status}`);
    }
    const xml = await response.text();
    const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const root = parsed?.CONSOLIDATED_LIST ?? {};
    await clearListData(listId);
    const entityRows = [];
    for (const ind of toArray(root.INDIVIDUALS?.INDIVIDUAL)) {
        const parts = [ind.FIRST_NAME, ind.SECOND_NAME, ind.THIRD_NAME, ind.FOURTH_NAME]
            .map((part) => String(part ?? "").trim())
            .filter(Boolean);
        const aliases = toArray(ind.INDIVIDUAL_ALIAS)
            .map((alias) => String(alias.ALIAS_NAME ?? "").trim())
            .filter(Boolean);
        entityRows.push({
            listId,
            sdnId: String(ind.DATAID ?? ""),
            name: parts.join(" ") || "Unknown",
            aliases: JSON.stringify(aliases),
            entityType: "individual",
            programs: JSON.stringify([String(ind.UN_LIST_TYPE ?? "")].filter(Boolean)),
            country: String(ind.NATIONALITY?.VALUE ?? "").trim() || null,
            remarks: String(ind.COMMENTS1 ?? "").trim() || null,
        });
    }
    for (const ent of toArray(root.ENTITIES?.ENTITY)) {
        const aliases = toArray(ent.ENTITY_ALIAS)
            .map((alias) => String(alias.ALIAS_NAME ?? "").trim())
            .filter(Boolean);
        entityRows.push({
            listId,
            sdnId: String(ent.DATAID ?? ""),
            name: String(ent.FIRST_NAME ?? "").trim() || "Unknown",
            aliases: JSON.stringify(aliases),
            entityType: "entity",
            programs: JSON.stringify([String(ent.UN_LIST_TYPE ?? "")].filter(Boolean)),
            country: null,
            remarks: String(ent.COMMENTS1 ?? "").trim() || null,
        });
    }
    let entityCount = 0;
    const batchSize = 200;
    for (let i = 0; i < entityRows.length; i += batchSize) {
        const inserted = await db_1.db
            .insert(schema_1.sanctionsEntities)
            .values(entityRows.slice(i, i + batchSize))
            .returning({ id: schema_1.sanctionsEntities.id });
        entityCount += inserted.length;
    }
    return { entityCount, addressCount: 0 };
}
function firstProperty(properties, names) {
    for (const name of names) {
        const values = toArray(properties[name]);
        const value = values.map(String).find((item) => item.trim());
        if (value)
            return value.trim();
    }
    return null;
}
function allProperties(properties, names) {
    return [
        ...new Set(names
            .flatMap((name) => toArray(properties[name]).map(String))
            .map((value) => value.trim())
            .filter(Boolean)),
    ];
}
function normalizeOpenSanctionsType(schemaName) {
    const lowered = schemaName.toLowerCase();
    if (lowered.includes("person"))
        return "individual";
    if (lowered.includes("vessel"))
        return "vessel";
    if (lowered.includes("aircraft"))
        return "aircraft";
    return "entity";
}
function detectCryptoNetwork(address) {
    if (/^T[A-Za-z0-9]{33}$/.test(address))
        return "TRX";
    if (/^0x[a-fA-F0-9]{40}$/.test(address))
        return "ETH";
    if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/i.test(address))
        return "BTC";
    return "UNKNOWN";
}
async function* responseLines(response) {
    if (!response.body) {
        throw new Error("Response body is empty");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            if (line.trim())
                yield line;
        }
    }
    buffer += decoder.decode();
    if (buffer.trim())
        yield buffer;
}
async function syncOpenSanctionsDataset(listId, dataset) {
    const slugs = [dataset.slug, ...(dataset.fallbackSlugs ?? [])];
    let response = null;
    let usedSlug = dataset.slug;
    for (const slug of slugs) {
        response = await fetch(openSanctionsUrl(slug), {
            headers: FETCH_HEADERS,
            signal: AbortSignal.timeout(900_000),
        });
        usedSlug = slug;
        if (response.ok)
            break;
        if (response.status !== 404)
            break;
    }
    if (!response?.ok) {
        throw new Error(`${dataset.name} fetch failed: ${response?.status ?? "unknown"} ${response?.statusText ?? ""}`);
    }
    if (usedSlug !== dataset.slug) {
        await db_1.db
            .update(schema_1.sanctionsLists)
            .set({ source: openSanctionsUrl(usedSlug), updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.sanctionsLists.id, listId));
    }
    await clearListData(listId);
    let entityRows = [];
    let cryptoCandidates = [];
    let entityCount = 0;
    let addressCount = 0;
    const sdnToEntityId = {};
    const batchSize = 200;
    const flushBatch = async () => {
        if (entityRows.length === 0)
            return;
        const inserted = await db_1.db
            .insert(schema_1.sanctionsEntities)
            .values(entityRows)
            .returning({ id: schema_1.sanctionsEntities.id, sdnId: schema_1.sanctionsEntities.sdnId });
        entityCount += inserted.length;
        for (const entity of inserted) {
            if (entity.sdnId)
                sdnToEntityId[entity.sdnId] = entity.id;
        }
        if (cryptoCandidates.length > 0) {
            const rows = cryptoCandidates.map((candidate) => ({
                listId,
                entityId: sdnToEntityId[candidate.sdnId] ?? null,
                address: candidate.address,
                network: candidate.network,
                sdnId: candidate.sdnId || null,
                entityName: candidate.entityName,
                programs: JSON.stringify(candidate.programs),
            }));
            const insertedCrypto = await db_1.db
                .insert(schema_1.sanctionsCryptoAddresses)
                .values(rows)
                .onConflictDoNothing()
                .returning({ id: schema_1.sanctionsCryptoAddresses.id });
            addressCount += insertedCrypto.length;
        }
        entityRows = [];
        cryptoCandidates = [];
    };
    for await (const line of responseLines(response)) {
        const item = JSON.parse(line);
        const properties = item.properties ?? {};
        const schemaName = item.schema ?? "Entity";
        const name = firstProperty(properties, ["name", "legalName", "firstName"]) ??
            item.caption?.trim() ??
            "";
        if (!name)
            continue;
        const aliases = allProperties(properties, [
            "alias",
            "weakAlias",
            "previousName",
            "name",
        ]).filter((alias) => alias !== name);
        const programs = allProperties(properties, [
            "program",
            "authority",
            "sourceUrl",
            "topics",
        ]);
        const cryptoAddresses = allProperties(properties, [
            "cryptoWallet",
            "cryptoWallets",
            "wallet",
            "publicKey",
        ]);
        entityRows.push({
            listId,
            sdnId: item.id ?? null,
            name,
            aliases: JSON.stringify(aliases),
            entityType: normalizeOpenSanctionsType(schemaName),
            programs: JSON.stringify(programs),
            country: firstProperty(properties, ["country", "nationality", "jurisdiction"]),
            remarks: firstProperty(properties, ["notes", "summary", "description"]),
        });
        for (const address of cryptoAddresses) {
            cryptoCandidates.push({
                sdnId: item.id ?? "",
                entityName: name,
                address,
                network: detectCryptoNetwork(address),
                programs,
            });
        }
        if (entityRows.length >= batchSize) {
            await flushBatch();
        }
    }
    await flushBatch();
    return { entityCount, addressCount };
}
function syncEUConsolidated(listId) {
    return syncOpenSanctionsDataset(listId, {
        name: "EU Consolidated",
        slug: "eu_fsf",
        description: "European Union Financial Sanctions Files",
    });
}
async function runFullSync(listFilter) {
    if (syncInProgress) {
        return [
            {
                list: listFilter ?? "all",
                entityCount: 0,
                addressCount: 0,
                status: "error",
                error: "A sync is already running. Try again when it finishes.",
            },
        ];
    }
    syncInProgress = true;
    try {
        const listIds = await ensureListRecords();
        const results = [];
        const tasks = [
            { name: "OFAC SDN", fn: syncOFACSDN },
            { name: "OFAC Consolidated", fn: syncOfacConsolidated },
            { name: "UN Consolidated", fn: syncUNConsolidated },
            { name: "EU Consolidated", fn: syncEUConsolidated },
            ...OPEN_SANCTIONS_DATASETS.map((dataset) => ({
                name: dataset.name,
                fn: (id) => syncOpenSanctionsDataset(id, dataset),
            })),
            ...private_csv_sync_1.PRIVATE_LISTS.map((list) => ({
                name: list.name,
                fn: (id) => (0, private_csv_sync_1.syncPrivateCsvList)(list, id),
            })),
        ];
        for (const task of tasks) {
            if (listFilter && task.name !== listFilter)
                continue;
            const listId = listIds[task.name];
            if (!listId)
                continue;
            await db_1.db
                .update(schema_1.sanctionsLists)
                .set({ status: "syncing", errorMessage: null, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_1.sanctionsLists.id, listId));
            try {
                const { entityCount, addressCount } = await task.fn(listId);
                await db_1.db
                    .update(schema_1.sanctionsLists)
                    .set({
                    status: "active",
                    entityCount,
                    addressCount,
                    lastSync: new Date(),
                    updatedAt: new Date(),
                    errorMessage: null,
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.sanctionsLists.id, listId));
                results.push({ list: task.name, entityCount, addressCount, status: "success" });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`Sync failed for ${task.name}:`, message);
                await db_1.db
                    .update(schema_1.sanctionsLists)
                    .set({ status: "error", errorMessage: message, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema_1.sanctionsLists.id, listId));
                results.push({
                    list: task.name,
                    entityCount: 0,
                    addressCount: 0,
                    status: "error",
                    error: message,
                });
            }
        }
        return results;
    }
    finally {
        syncInProgress = false;
    }
}
