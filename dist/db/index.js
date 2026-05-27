"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initializeDatabaseSchema = initializeDatabaseSchema;
exports.waitForDatabase = waitForDatabase;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = __importStar(require("./schema"));
const databaseUrl = process.env.DATABASE_URL;
const hasPgEnv = process.env.PGHOST &&
    process.env.PGUSER &&
    process.env.PGPASSWORD &&
    process.env.PGDATABASE;
if (!databaseUrl && !hasPgEnv) {
    throw new Error("Database connection is missing. In Coolify, set DATABASE_URL to the internal Postgres connection string, or set PGHOST, PGUSER, PGPASSWORD, PGDATABASE, and optionally PGPORT.");
}
const pool = new pg_1.Pool({
    connectionString: databaseUrl || undefined,
    connectionTimeoutMillis: 5_000,
});
exports.db = (0, node_postgres_1.drizzle)(pool, { schema });
async function initializeDatabaseSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sanctions_lists (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            source TEXT NOT NULL,
            description TEXT,
            last_sync TIMESTAMP,
            entity_count INTEGER DEFAULT 0,
            address_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sanctions_entities (
            id SERIAL PRIMARY KEY,
            list_id INTEGER NOT NULL REFERENCES sanctions_lists(id),
            sdn_id TEXT,
            name TEXT NOT NULL,
            aliases TEXT,
            entity_type TEXT,
            programs TEXT,
            country TEXT,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS entity_name_idx ON sanctions_entities(name);
        CREATE INDEX IF NOT EXISTS entity_list_idx ON sanctions_entities(list_id);
        CREATE INDEX IF NOT EXISTS entity_sdn_idx ON sanctions_entities(sdn_id);

        CREATE TABLE IF NOT EXISTS sanctions_crypto_addresses (
            id SERIAL PRIMARY KEY,
            list_id INTEGER NOT NULL REFERENCES sanctions_lists(id),
            entity_id INTEGER REFERENCES sanctions_entities(id),
            address TEXT NOT NULL,
            network TEXT NOT NULL,
            sdn_id TEXT,
            entity_name TEXT,
            programs TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS crypto_list_address_network_idx
            ON sanctions_crypto_addresses(list_id, address, network);
        CREATE INDEX IF NOT EXISTS crypto_address_idx ON sanctions_crypto_addresses(address);
        CREATE INDEX IF NOT EXISTS crypto_network_idx ON sanctions_crypto_addresses(network);

        ALTER TABLE sanctions_crypto_addresses
            DROP CONSTRAINT IF EXISTS sanctions_crypto_addresses_entity_id_sanctions_entities_id_fkey;
        ALTER TABLE sanctions_crypto_addresses
            ADD CONSTRAINT sanctions_crypto_addresses_entity_id_sanctions_entities_id_fkey
            FOREIGN KEY (entity_id) REFERENCES sanctions_entities(id) ON DELETE CASCADE;

        INSERT INTO sanctions_lists (name, source, description, status)
        VALUES
            ('OFAC SDN', 'https://www.treasury.gov/ofac/downloads/sdn.xml', 'US Treasury OFAC Specially Designated Nationals and Blocked Persons List', 'pending'),
            ('OFAC Consolidated', 'https://www.treasury.gov/ofac/downloads/consolidated/consolidated.xml', 'US Treasury OFAC Consolidated Sanctions List', 'pending'),
            ('UN Consolidated', 'https://scsanctions.un.org/resources/xml/en/consolidated.xml', 'United Nations Security Council Consolidated Sanctions List', 'pending'),
            ('EU Consolidated', 'https://data.opensanctions.org/datasets/latest/eu_fsf/entities.ftm.json', 'European Union Financial Sanctions Files (CFSP)', 'pending'),
            ('PEP OpenSanctions', 'https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json', 'Politically exposed persons collection from OpenSanctions', 'pending'),
            ('IL NBCTF', 'https://data.opensanctions.org/datasets/latest/il_nbctf/entities.ftm.json', 'Israel National Bureau for Counter Terror Financing sanctions and seizure data via OpenSanctions', 'pending'),
            ('JP MOF', 'https://data.opensanctions.org/datasets/latest/jp_mof_sanctions/entities.ftm.json', 'Japan Ministry of Finance sanctions list via OpenSanctions', 'pending'),
            ('GB OFSI', 'https://data.opensanctions.org/datasets/latest/gb_fcdo_sanctions/entities.ftm.json', 'United Kingdom financial sanctions list maintained by OFSI/FCDO via OpenSanctions', 'pending'),
            ('CH SECO', 'https://data.opensanctions.org/datasets/latest/ch_seco_sanctions/entities.ftm.json', 'Swiss SECO sanctions list via OpenSanctions', 'pending'),
            ('EU FSF', 'https://data.opensanctions.org/datasets/latest/eu_fsf/entities.ftm.json', 'European Union Financial Sanctions Files via OpenSanctions', 'pending'),
            ('FR DG Tresor', 'https://data.opensanctions.org/datasets/latest/fr_tresor_gels_avoir/entities.ftm.json', 'French Directorate General of the Treasury asset freeze list via OpenSanctions', 'pending'),
            ('AU DFAT', 'https://data.opensanctions.org/datasets/latest/au_dfat_sanctions/entities.ftm.json', 'Australian DFAT consolidated sanctions list via OpenSanctions', 'pending'),
            ('CA GAC', 'https://data.opensanctions.org/datasets/latest/ca_dfatd_sema_sanctions/entities.ftm.json', 'Global Affairs Canada sanctions list via OpenSanctions', 'pending'),
            ('Private Extremistas', 'private://extremistas.csv', 'Private extremist groups crypto intelligence list', 'pending'),
            ('WSL', 'private://wsl.csv', 'Private WSL crypto intelligence list', 'pending'),
            ('Private Scams', 'private://scams.csv', 'Private scams intelligence list', 'pending'),
            ('Private Malware', 'private://malware.csv', 'Private malware crypto intelligence list', 'pending'),
            ('Private Hackers', 'private://hackers.csv', 'Private hackers crypto intelligence list', 'pending')
        ON CONFLICT (name) DO UPDATE SET
            source = EXCLUDED.source,
            description = EXCLUDED.description,
            updated_at = NOW();
    `);
}
async function waitForDatabase(retries = 30, delayMs = 2_000) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            const client = await pool.connect();
            client.release();
            return;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Database connection failed (${attempt}/${retries}): ${message}`);
            if (attempt === retries) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}
