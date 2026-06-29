'use strict';
const { getAuth } = require('./_lib/auth');
const { sendJson } = require('./_lib/http');

module.exports = async (req, res) => {
  const auth = getAuth(req);
  if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
  sendJson(res, 200, { name: auth.name, email: auth.email });
};
