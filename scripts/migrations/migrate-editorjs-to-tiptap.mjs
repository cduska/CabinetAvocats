/**
 * Migration : EditorJS JSON → TipTap JSON
 *
 * Tables ciblées :
 *   - modele_document.contenu_json          WHERE contenu_json ? 'blocks'
 *   - modele_document_version.contenu_json  WHERE contenu_json ? 'blocks'
 *   - document.metadata_json               WHERE metadata_json->'contenuJson' ? 'blocks'
 *
 * Usage : node scripts/migrations/migrate-editorjs-to-tiptap.mjs [--dry-run]
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ═══════════════════════════════════════════════════════════════
//  DB setup
// ═══════════════════════════════════════════════════════════════

function getPoolConfig() {
  const url = process.env.DATABASE_URL;
  if (url) return { connectionString: url };
  return {
    host:     process.env.PGHOST     || '127.0.0.1',
    port:     Number(process.env.PGPORT || 5432),
    user:     process.env.PGUSER     || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres',
  };
}

const { Pool } = pg;
const pool = new Pool(getPoolConfig());

async function query(sql, params = []) {
  return pool.query(sql, params);
}

// ═══════════════════════════════════════════════════════════════
//  HTML inline parser  (handles <b> <i> <u> <s> <br> entities)
// ═══════════════════════════════════════════════════════════════

const TAG_TO_MARK = { b: 'bold', strong: 'bold', i: 'italic', em: 'italic', u: 'underline', s: 'strike', del: 'strike' };

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

/**
 * Converts an EditorJS inline HTML string into an array of TipTap inline nodes.
 * Handles <b>, <i>, <u>, <s>, <br> and arbitrary text.
 */
function parseInlineHtml(html) {
  if (!html) return [];
  // Split on <br> first → inject hardBreak nodes between segments
  const segments = html.split(/<br\s*\/?>/i);
  const nodes = [];
  for (let s = 0; s < segments.length; s++) {
    nodes.push(...parseSegment(segments[s]));
    if (s < segments.length - 1) nodes.push({ type: 'hardBreak' });
  }
  return nodes.length > 0 ? nodes : [{ type: 'text', text: '' }];
}

function parseSegment(html) {
  const nodes = [];
  const activeMarks = [];
  // Tokenise: tags or text
  const regex = /<(\/?)([a-zA-Z]+)[^>]*>|([^<]+)/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (m[3] !== undefined) {
      // Text node
      const text = decodeEntities(m[3]);
      if (text) {
        const node = { type: 'text', text };
        if (activeMarks.length > 0) node.marks = activeMarks.map(t => ({ type: t }));
        nodes.push(node);
      }
    } else {
      const closing = m[1] === '/';
      const tag = m[2].toLowerCase();
      const mark = TAG_TO_MARK[tag];
      if (mark) {
        if (!closing) {
          activeMarks.push(mark);
        } else {
          const idx = activeMarks.lastIndexOf(mark);
          if (idx !== -1) activeMarks.splice(idx, 1);
        }
      }
    }
  }
  return nodes;
}

// ═══════════════════════════════════════════════════════════════
//  Block converters
// ═══════════════════════════════════════════════════════════════

function textContent(htmlString) {
  const nodes = parseInlineHtml(htmlString || '');
  return nodes.length > 0 ? nodes : undefined;
}

function convertBlock(block) {
  const { type, data = {} } = block;
  switch (type) {
    case 'header': {
      const level = data.level ?? 2;
      const content = textContent(data.text);
      return { type: 'heading', attrs: { level, textAlign: null }, ...(content ? { content } : {}) };
    }

    case 'paragraph': {
      const content = textContent(data.text);
      return { type: 'paragraph', ...(content ? { content } : {}) };
    }

    case 'list': {
      const listType = data.style === 'ordered' ? 'orderedList' : 'bulletList';
      const items = (data.items || []).map(item => {
        // Items may be plain strings (v1) or objects { content, items } (v2)
        const rawText = typeof item === 'string' ? item : (item?.content ?? '');
        return {
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInlineHtml(rawText) }],
        };
      });
      return { type: listType, content: items };
    }

    case 'quote': {
      const content = textContent(data.text);
      return {
        type: 'blockquote',
        content: [{ type: 'paragraph', ...(content ? { content } : {}) }],
      };
    }

    case 'delimiter':
      return { type: 'horizontalRule' };

    default:
      // Unknown block: emit an empty paragraph
      return { type: 'paragraph' };
  }
}

/**
 * Converts an EditorJS JSON document to a TipTap JSON document.
 * Returns null if the input is already TipTap or has no blocks.
 */
function editorjsToTiptap(doc) {
  if (!doc || typeof doc !== 'object') return null;
  if (doc.type === 'doc') return null; // already TipTap
  if (!Array.isArray(doc.blocks)) return null;

  return {
    type: 'doc',
    content: doc.blocks.map(convertBlock),
  };
}

// ═══════════════════════════════════════════════════════════════
//  Migration runners
// ═══════════════════════════════════════════════════════════════

async function migrateModeleDocument(dryRun) {
  const { rows } = await query(
    `SELECT id, contenu_json FROM modele_document WHERE contenu_json ? 'blocks'`
  );
  console.log(`modele_document: ${rows.length} row(s) to migrate`);
  let ok = 0, skip = 0;
  for (const row of rows) {
    const tiptap = editorjsToTiptap(row.contenu_json);
    if (!tiptap) { skip++; continue; }
    if (!dryRun) {
      await query(`UPDATE modele_document SET contenu_json = $1 WHERE id = $2`, [
        JSON.stringify(tiptap),
        row.id,
      ]);
    }
    ok++;
  }
  console.log(`  converted: ${ok}, skipped: ${skip}`);
}

async function migrateModeleDocumentVersion(dryRun) {
  const { rows } = await query(
    `SELECT id, contenu_json FROM modele_document_version WHERE contenu_json ? 'blocks'`
  );
  console.log(`modele_document_version: ${rows.length} row(s) to migrate`);
  let ok = 0, skip = 0;
  for (const row of rows) {
    const tiptap = editorjsToTiptap(row.contenu_json);
    if (!tiptap) { skip++; continue; }
    if (!dryRun) {
      await query(`UPDATE modele_document_version SET contenu_json = $1 WHERE id = $2`, [
        JSON.stringify(tiptap),
        row.id,
      ]);
    }
    ok++;
  }
  console.log(`  converted: ${ok}, skipped: ${skip}`);
}

async function migrateDocument(dryRun) {
  const { rows } = await query(
    `SELECT id, metadata_json FROM document WHERE metadata_json->'contenuJson' ? 'blocks'`
  );
  console.log(`document: ${rows.length} row(s) to migrate`);
  let ok = 0, skip = 0;
  for (const row of rows) {
    const editorjsDoc = row.metadata_json?.contenuJson;
    const tiptap = editorjsToTiptap(editorjsDoc);
    if (!tiptap) { skip++; continue; }
    const newMeta = { ...row.metadata_json, contenuJson: tiptap };
    if (!dryRun) {
      await query(`UPDATE document SET metadata_json = $1 WHERE id = $2`, [
        JSON.stringify(newMeta),
        row.id,
      ]);
    }
    ok++;
  }
  console.log(`  converted: ${ok}, skipped: ${skip}`);
}

// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════

const dryRun = process.argv.includes('--dry-run');
if (dryRun) console.log('*** DRY RUN — no changes will be written ***\n');

try {
  await migrateModeleDocument(dryRun);
  await migrateModeleDocumentVersion(dryRun);
  await migrateDocument(dryRun);
  console.log('\nMigration complete.');
} catch (err) {
  console.error('Migration error:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
