'use strict';
/* Local dev server — mounts the /api functions and serves static files,
 * using node:sqlite (run with --experimental-sqlite). Production uses Vercel
 * functions + Postgres; this is only for local testing. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8900;

const routes = {
  '/api/setup': require('../api/setup.js'),
  '/api/login': require('../api/login.js'),
  '/api/logout': require('../api/logout.js'),
  '/api/me': require('../api/me.js'),
  '/api/members': require('../api/members.js'),
  '/api/admins': require('../api/admins.js'),
  '/api/stats': require('../api/stats.js'),
};
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const pathname = url.parse(req.url).pathname;
  if (routes[pathname]) {
    try { await routes[pathname](req, res); }
    catch (e) { console.error(e); res.statusCode = 500; res.end(JSON.stringify({ error: String(e && e.message || e) })); }
    return;
  }
  // static (with simple cleanUrls + directory index)
  let rel = pathname;
  if (rel === '/') rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin/index.html';
  if (rel === '/admin/login') rel = '/admin/login.html';
  let fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp) && fs.existsSync(fp + '.html')) fp += '.html';
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    res.setHeader('Content-Type', TYPES[path.extname(fp)] || 'application/octet-stream');
    fs.createReadStream(fp).pipe(res);
  } else { res.statusCode = 404; res.end('Not found'); }
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));
