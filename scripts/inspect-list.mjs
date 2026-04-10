import pg from 'pg';
import { getPgClientConfig } from '../server/db-config.js';

const { Client } = pg;
const client = new Client(getPgClientConfig());
await client.connect();

const res = await client.query(`
  SELECT id, nom_modele,
    (SELECT blk FROM jsonb_array_elements(contenu_json->'blocks') blk
     WHERE blk->>'type' = 'list' LIMIT 1) AS sample_list_block
  FROM modele_document
  WHERE contenu_json ? 'blocks'
  LIMIT 3
`);

res.rows.forEach(r => {
  console.log('--- modele:', r.nom_modele);
  console.log(JSON.stringify(r.sample_list_block, null, 2));
});

await client.end();
