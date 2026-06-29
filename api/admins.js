'use strict';
const crypto = require('crypto');
const db = require('./_lib/db');
const { getAuth, hash } = require('./_lib/auth');
const { sendJson, getQuery, readJson } = require('./_lib/http');

module.exports = async (req, res) => {
  const auth = getAuth(req);
  if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { rows } = await db.query('SELECT id, name, email, created_at FROM admins ORDER BY created_at ASC');
    return sendJson(res, 200, { admins: rows });
  }

  if (req.method === 'POST') {
    const b = await readJson(req);
    const email = String(b.email || '').toLowerCase();
    if (!b.name || !email || !b.password) return sendJson(res, 400, { error: 'Name, email and password are required' });
    if (String(b.password).length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters' });
    const { rows: ex } = await db.query('SELECT id FROM admins WHERE email=$1', [email]);
    if (ex.length) return sendJson(res, 409, { error: 'An admin with that email already exists' });
    await db.query(
      'INSERT INTO admins (id, name, email, password_hash, created_at) VALUES ($1,$2,$3,$4,$5)',
      [crypto.randomUUID(), b.name, email, await hash(b.password), new Date().toISOString()]
    );
    return sendJson(res, 201, { ok: true });
  }

  if (req.method === 'DELETE') {
    const q = getQuery(req);
    if (!q.id) return sendJson(res, 400, { error: 'id is required' });
    if (q.id === auth.id) return sendJson(res, 400, { error: 'You cannot delete your own account' });
    const { rows: cnt } = await db.query('SELECT COUNT(*) AS n FROM admins');
    if (Number(cnt[0].n) <= 1) return sendJson(res, 400, { error: 'Cannot delete the last admin' });
    await db.query('DELETE FROM admins WHERE id=$1', [q.id]);
    return sendJson(res, 200, { ok: true });
  }

  sendJson(res, 405, { error: 'Method not allowed' });
};
