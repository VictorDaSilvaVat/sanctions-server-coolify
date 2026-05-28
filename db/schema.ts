import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const sanctionsLists = pgTable('sanctions_lists', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  source: text('source').notNull(),
  description: text('description'),
  lastSync: timestamp('last_sync'),
  entityCount: integer('entity_count').default(0),
  addressCount: integer('address_count').default(0),
  status: text('status').default('pending'), // pending | syncing | active | error
  errorMessage: text('error_message'),
  category: text('category').default('official'), // official | unofficial
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const sanctionsEntities = pgTable(
  'sanctions_entities',
  {
    id: serial('id').primaryKey(),
    listId: integer('list_id')
      .references(() => sanctionsLists.id)
      .notNull(),
    sdnId: text('sdn_id'),
    name: text('name').notNull(),
    aliases: text('aliases'), // JSON array stored as text
    entityType: text('entity_type'), // individual | entity | vessel | aircraft
    programs: text('programs'), // JSON array stored as text
    country: text('country'),
    remarks: text('remarks'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('entity_name_idx').on(t.name),
    index('entity_list_idx').on(t.listId),
    index('entity_sdn_idx').on(t.sdnId),
  ],
)

export const sanctionsCryptoAddresses = pgTable(
  'sanctions_crypto_addresses',
  {
    id: serial('id').primaryKey(),
    listId: integer('list_id')
      .references(() => sanctionsLists.id)
      .notNull(),
    entityId: integer('entity_id').references(() => sanctionsEntities.id, {
      onDelete: 'cascade',
    }),
    address: text('address').notNull(),
    network: text('network').notNull(), // BTC | ETH | XMR | TRX | etc.
    sdnId: text('sdn_id'),
    entityName: text('entity_name'),
    programs: text('programs'), // JSON array stored as text
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    uniqueIndex('crypto_list_address_network_idx').on(
      t.listId,
      t.address,
      t.network,
    ),
    index('crypto_address_idx').on(t.address),
    index('crypto_network_idx').on(t.network),
  ],
)
