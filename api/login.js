'use strict';
const db = require('./_lib/db');
const { compare, sign, setCookie } = require('./_lib/auth');
const { sendJson, readJson } = require('./_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  const { email, password } = await readJson(req);
  if (!email || !password) return sendJson(res, 400, { error: 'Email and password are required' });

  const { rows } = await db.query('SELECT * FROM admins WHERE email=$1', [String(email).toLowerCase()]);
  const admin = rows[0];
  if (!admin || !(await compare(password, admin.password_hash))) {
    return sendJson(res, 401, { error: 'Invalid email or password' });
  }
  setCookie(res, sign({ id: admin.id, email: admin.email, name: admin.name }));
  sendJson(res, 200, { name: admin.name, email: admin.email });
};
