'use strict';
const crypto = require('crypto');
const db = require('./_lib/db');
const { getAuth } = require('./_lib/auth');
const { sendJson, getQuery, readJson } = require('./_lib/http');

const FIELDS = ['full_name', 'email', 'phone', 'dojo', 'rank', 'membership_type', 'status', 'payment_status', 'join_date', 'expiry_date', 'notes'];

module.exports = async (req, res) => {
  if (!getAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
  const q = getQuery(req);

  // ---- GET: list (with filters) or single (?id) ----
  if (req.method === 'GET') {
    if (q.id) {
      const { rows } = await db.query('SELECT * FROM members WHERE id=$1', [q.id]);
      return sendJson(res, 200, rows[0] || null);
    }
    const where = [];
    const p = [];
    if (q.search) {
      const s = '%' + String(q.search).toLowerCase() + '%';
      const a = p.push(s), b = p.push(s), c = p.push(s);
      where.push(`(LOWER(full_name) LIKE $${a} OR LOWER(COALESCE(email,'')) LIKE $${b} OR LOWER(COALESCE(phone,'')) LIKE $${c})`);
    }
    if (q.status && q.status !== 'all') { const i = p.push(q.status); where.push(`status=$${i}`); }
    if (q.payment && q.payment !== 'all') { const i = p.push(q.payment); where.push(`payment_status=$${i}`); }
    if (q.dojo && q.dojo !== 'all') { const i = p.push(q.dojo); where.push(`dojo=$${i}`); }
    const sql = 'SELECT * FROM members' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY full_name ASC';
    const { rows } = await db.query(sql, p);
    return sendJson(res, 200, { members: rows });
  }

  // ---- POST: create ----
  if (req.method === 'POST') {
    const b = await readJson(req);
    if (!b.full_name || !String(b.full_name).trim()) return sendJson(res, 400, { error: 'Full name is required' });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.query(
      `INSERT INTO members (id, full_name, email, phone, dojo, rank, membership_type, status, payment_status, join_date, expiry_date, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, b.full_name, b.email || null, b.phone || null, b.dojo || null, b.rank || null, b.membership_type || null,
       b.status || 'active', b.payment_status || 'paid', b.join_date || null, b.expiry_date || null, b.notes || null, now, now]
    );
    const { rows } = await db.query('SELECT * FROM members WHERE id=$1', [id]);
    return sendJson(res, 201, rows[0]);
  }

  // ---- PUT: update (?id) ----
  if (req.method === 'PUT') {
    if (!q.id) return sendJson(res, 400, { error: 'id is required' });
    const b = await readJson(req);
    const sets = [];
    const p = [];
    for (const f of FIELDS) {
      if (f in b) { const i = p.push(b[f] === '' ? null : b[f]); sets.push(`${f}=$${i}`); }
    }
    if (!sets.length) return sendJson(res, 400, { error: 'Nothing to update' });
    const ti = p.push(new Date().toISOString()); sets.push(`updated_at=$${ti}`);
    const idi = p.push(q.id);
    await db.query(`UPDATE members SET ${sets.join(', ')} WHERE id=$${idi}`, p);
    const { rows } = await db.query('SELECT * FROM members WHERE id=$1', [q.id]);
    return sendJson(res, 200, rows[0] || null);
  }

  // ---- DELETE (?id) ----
  if (req.method === 'DELETE') {
    if (!q.id) return sendJson(res, 400, { error: 'id is required' });
    await db.query('DELETE FROM members WHERE id=$1', [q.id]);
    return sendJson(res, 200, { ok: true });
  }

  sendJson(res, 405, { error: 'Method not allowed' });
};
