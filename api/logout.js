'use strict';
const { clearCookie } = require('./_lib/auth');
const { sendJson } = require('./_lib/http');

module.exports = async (req, res) => {
  clearCookie(res);
  sendJson(res, 200, { ok: true });
};
