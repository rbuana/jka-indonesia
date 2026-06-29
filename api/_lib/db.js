'use strict';
/*
 * Dual-driver data layer.
 *  - Production (Vercel): uses @vercel/postgres when POSTGRES_URL is set.
 *  - Local dev: uses Node's built-in node:sqlite (run with --experimental-sqlite).
 * Queries are written Postgres-style ($1, $2 ...). For SQLite the placeholders
 * are converted to `?` in positional order, so do NOT reuse a placeholder index.
 */
let _drv;

function driver() {
  if (_drv) return _drv;
  const url = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  if (url) {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(url);
    _drv = {
      kind: 'neon',
      async query(text, params = []) {
        const out = await sql.query(text, params);
        return { rows: Array.isArray(out) ? out : (out && out.rows) || [] };
      },
    };
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const sdb = new DatabaseSync(path.join(dir, 'dev.sqlite'));
    _drv = {
      kind: 'sqlite',
      async query(text, params = []) {
        const sql = text.replace(/\$(\d+)/g, '?');
        const head = sql.trim().slice(0, 6).toLowerCase();
        const returns = head === 'select' || head.startsWith('with') || / returning /i.test(sql);
        const p = params.map((v) => (v === undefined ? null : v));
        const stmt = sdb.prepare(sql);
        if (returns) return { rows: stmt.all(...p) };
        const info = stmt.run(...p);
        return { rows: [], rowCount: Number(info.changes || 0) };
      },
    };
  }
  return _drv;
}

module.exports = {
  query: (text, params) => driver().query(text, params),
  kind: () => driver().kind,
};
