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
  ('OFAC SDN', 'https://www.treasury.gov/ofac/downloads/sdn.xml', 'US OFAC Specially Designated Nationals list', 'pending'),
  ('OFAC Consolidated', 'https://www.treasury.gov/ofac/downloads/consolidated/consolidated.xml', 'US OFAC consolidated sanctions list', 'pending'),
  ('UN Consolidated', 'https://scsanctions.un.org/resources/xml/en/consolidated.xml', 'UN Security Council consolidated list', 'pending'),
  ('EU Consolidated', 'https://data.opensanctions.org/datasets/latest/eu_fsf/entities.ftm.json', 'EU Financial Sanctions Files', 'pending'),
  ('PEP OpenSanctions', 'https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json', 'Politically exposed persons collection from OpenSanctions', 'pending'),
  ('IL NBCTF', 'https://data.opensanctions.org/datasets/latest/il_nbctf/entities.ftm.json', 'Israel NBCTF sanctions data via OpenSanctions', 'pending'),
  ('JP MOF', 'https://data.opensanctions.org/datasets/latest/jp_mof_sanctions/entities.ftm.json', 'Japan MOF sanctions data via OpenSanctions', 'pending'),
  ('GB OFSI', 'https://data.opensanctions.org/datasets/latest/gb_fcdo_sanctions/entities.ftm.json', 'UK OFSI/FCDO sanctions data via OpenSanctions', 'pending'),
  ('CH SECO', 'https://data.opensanctions.org/datasets/latest/ch_seco_sanctions/entities.ftm.json', 'Swiss SECO sanctions data via OpenSanctions', 'pending'),
  ('EU FSF', 'https://data.opensanctions.org/datasets/latest/eu_fsf/entities.ftm.json', 'EU Financial Sanctions Files via OpenSanctions', 'pending'),
  ('FR DG Tresor', 'https://data.opensanctions.org/datasets/latest/fr_tresor_gels_avoir/entities.ftm.json', 'French DG Tresor asset freeze data via OpenSanctions', 'pending'),
  ('AU DFAT', 'https://data.opensanctions.org/datasets/latest/au_dfat_sanctions/entities.ftm.json', 'Australian DFAT sanctions data via OpenSanctions', 'pending'),
  ('CA GAC', 'https://data.opensanctions.org/datasets/latest/ca_dfatd_sema_sanctions/entities.ftm.json', 'Global Affairs Canada sanctions data via OpenSanctions', 'pending'),
  ('Private Extremistas', 'private://extremistas.csv', 'Private extremist groups crypto intelligence list', 'pending'),
  ('WSL', 'private://wsl.csv', 'Private WSL crypto intelligence list', 'pending'),
  ('Private Scams', 'private://scams.csv', 'Private scams intelligence list', 'pending'),
  ('Private Malware', 'private://malware.csv', 'Private malware crypto intelligence list', 'pending'),
  ('Private Hackers', 'private://hackers.csv', 'Private hackers crypto intelligence list', 'pending')
ON CONFLICT (name) DO UPDATE SET
  source = EXCLUDED.source,
  description = EXCLUDED.description,
  updated_at = NOW();
