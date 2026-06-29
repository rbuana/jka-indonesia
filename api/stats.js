'use strict';
const db = require('./_lib/db');
const { getAuth } = require('./_lib/auth');
const { sendJson } = require('./_lib/http');

module.exports = async (req, res) => {
  if (!getAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
  const count = async (sql, params = []) => Number((await db.query(sql, params)).rows[0].n);

  const total = await count('SELECT COUNT(*) AS n FROM members');
  const active = await count('SELECT COUNT(*) AS n FROM members WHERE status=$1', ['active']);
  const inactive = await count('SELECT COUNT(*) AS n FROM members WHERE status=$1', ['inactive']);
  const outstanding = await count('SELECT COUNT(*) AS n FROM members WHERE payment_status=$1', ['outstanding']);
  const paid = await count('SELECT COUNT(*) AS n FROM members WHERE payment_status=$1', ['paid']);

  sendJson(res, 200, { total, active, inactive, outstanding, paid });
};
