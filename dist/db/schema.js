"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanctionsCryptoAddresses = exports.sanctionsEntities = exports.sanctionsLists = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.sanctionsLists = (0, pg_core_1.pgTable)('sanctions_lists', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull().unique(),
    source: (0, pg_core_1.text)('source').notNull(),
    description: (0, pg_core_1.text)('description'),
    lastSync: (0, pg_core_1.timestamp)('last_sync'),
    entityCount: (0, pg_core_1.integer)('entity_count').default(0),
    addressCount: (0, pg_core_1.integer)('address_count').default(0),
    status: (0, pg_core_1.text)('status').default('pending'), // pending | syncing | active | error
    errorMessage: (0, pg_core_1.text)('error_message'),
    category: (0, pg_core_1.text)('category').default('official'), // official | unofficial
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.sanctionsEntities = (0, pg_core_1.pgTable)('sanctions_entities', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    listId: (0, pg_core_1.integer)('list_id')
        .references(() => exports.sanctionsLists.id)
        .notNull(),
    sdnId: (0, pg_core_1.text)('sdn_id'),
    name: (0, pg_core_1.text)('name').notNull(),
    aliases: (0, pg_core_1.text)('aliases'), // JSON array stored as text
    entityType: (0, pg_core_1.text)('entity_type'), // individual | entity | vessel | aircraft
    programs: (0, pg_core_1.text)('programs'), // JSON array stored as text
    country: (0, pg_core_1.text)('country'),
    remarks: (0, pg_core_1.text)('remarks'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
}, (t) => [
    (0, pg_core_1.index)('entity_name_idx').on(t.name),
    (0, pg_core_1.index)('entity_list_idx').on(t.listId),
    (0, pg_core_1.index)('entity_sdn_idx').on(t.sdnId),
]);
exports.sanctionsCryptoAddresses = (0, pg_core_1.pgTable)('sanctions_crypto_addresses', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    listId: (0, pg_core_1.integer)('list_id')
        .references(() => exports.sanctionsLists.id)
        .notNull(),
    entityId: (0, pg_core_1.integer)('entity_id').references(() => exports.sanctionsEntities.id, {
        onDelete: 'cascade',
    }),
    address: (0, pg_core_1.text)('address').notNull(),
    network: (0, pg_core_1.text)('network').notNull(), // BTC | ETH | XMR | TRX | etc.
    sdnId: (0, pg_core_1.text)('sdn_id'),
    entityName: (0, pg_core_1.text)('entity_name'),
    programs: (0, pg_core_1.text)('programs'), // JSON array stored as text
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
}, (t) => [
    (0, pg_core_1.uniqueIndex)('crypto_list_address_network_idx').on(t.listId, t.address, t.network),
    (0, pg_core_1.index)('crypto_address_idx').on(t.address),
    (0, pg_core_1.index)('crypto_network_idx').on(t.network),
]);
