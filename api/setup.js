'use strict';
const crypto = require('crypto');
const db = require('./_lib/db');
const { hash } = require('./_lib/auth');
const { sendJson, readJson } = require('./_lib/http');

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    dojo TEXT,
    rank TEXT,
    membership_type TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    payment_status TEXT NOT NULL DEFAULT 'paid',
    join_date TEXT,
    expiry_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

const SAMPLE = [
  { full_name: 'Budi Santoso', email: 'budi.santoso@example.com', phone: '+62 812-1100-2201', dojo: 'JKAI Honbu (001)', rank: '3rd Dan', membership_type: 'Annual', status: 'active', payment_status: 'paid', join_date: '2019-03-12', expiry_date: '2026-03-12' },
  { full_name: 'Siti Rahmawati', email: 'siti.rahma@example.com', phone: '+62 813-2233-4410', dojo: 'JKAI Dobin', rank: '5th Kyu', membership_type: 'Monthly', status: 'active', payment_status: 'outstanding', join_date: '2023-08-01', expiry_date: '2026-07-01' },
  { full_name: 'Agus Pratama', email: 'agus.pratama@example.com', phone: '+62 811-9087-1234', dojo: 'JKAI Jati Baru', rank: '1st Dan', membership_type: 'Annual', status: 'active', payment_status: 'paid', join_date: '2021-01-20', expiry_date: '2026-01-20' },
  { full_name: 'Dewi Lestari', email: 'dewi.lestari@example.com', phone: '+62 812-5566-7788', dojo: 'JKAI Green Bintaro Indah', rank: '7th Kyu', membership_type: 'Monthly', status: 'active', payment_status: 'paid', join_date: '2024-02-10', expiry_date: '2026-08-10' },
  { full_name: 'Eko Karyanto', email: 'eko.karyanto@example.com', phone: '+62 856-3344-1100', dojo: 'JKAI Satria Magelang', rank: '4th Dan', membership_type: 'Lifetime', status: 'active', payment_status: 'paid', join_date: '2015-06-05', expiry_date: null },
  { full_name: 'Rina Wijaya', email: 'rina.wijaya@example.com', phone: '+62 813-7788-9900', dojo: 'JKAI Dobin', rank: '2nd Kyu', membership_type: 'Annual', status: 'inactive', payment_status: 'outstanding', join_date: '2020-09-15', expiry_date: '2025-09-15' },
  { full_name: 'Taufik Hidayat', email: 'taufik.h@example.com', phone: '+62 812-1212-3434', dojo: 'JKAI Green Bintaro Indah', rank: '2nd Dan', membership_type: 'Annual', status: 'active', payment_status: 'paid', join_date: '2018-11-22', expiry_date: '2026-11-22' },
  { full_name: 'Maya Anggraini', email: 'maya.a@example.com', phone: '+62 815-4567-2233', dojo: 'JKAI Sakti Sidoarjo', rank: '6th Kyu', membership_type: 'Monthly', status: 'active', payment_status: 'outstanding', join_date: '2024-05-30', expiry_date: '2026-06-30' },
  { full_name: 'Irlandia Dwi Fesyara', email: 'irlandia.df@example.com', phone: '+62 811-2020-3030', dojo: 'JKAI Polsek Bogor Selatan', rank: '1st Dan', membership_type: 'Annual', status: 'active', payment_status: 'paid', join_date: '2022-04-18', expiry_date: '2026-04-18' },
  { full_name: 'Ramli Saragih', email: 'ramli.saragih@example.com', phone: '+62 821-9988-7766', dojo: 'JKAI Budo Karate Professional', rank: '3rd Dan', membership_type: 'Lifetime', status: 'active', payment_status: 'paid', join_date: '2016-02-14', expiry_date: null },
  { full_name: 'Putri Maharani', email: 'putri.m@example.com', phone: '+62 812-3030-4040', dojo: 'JKAI Jati Baru', rank: '8th Kyu', membership_type: 'Monthly', status: 'inactive', payment_status: 'paid', join_date: '2023-12-01', expiry_date: '2025-12-01' },
  { full_name: 'Hendra Gunawan', email: 'hendra.g@example.com', phone: '+62 813-5050-6060', dojo: 'JKAI Honbu (001)', rank: '1st Kyu', membership_type: 'Annual', status: 'active', payment_status: 'outstanding', join_date: '2021-07-07', expiry_date: '2026-07-07' },
  { full_name: 'Nori Ansari', email: 'nori.ansari@example.com', phone: '+62 811-6060-7070', dojo: 'JKAI Dobin', rank: '2nd Dan', membership_type: 'Annual', status: 'active', payment_status: 'paid', join_date: '2019-10-10', expiry_date: '2026-10-10' },
  { full_name: 'Tan Indra', email: 'tan.indra@example.com', phone: '+62 821-7070-8080', dojo: 'JKAI Sakti Sidoarjo', rank: '3rd Dan', membership_type: 'Lifetime', status: 'active', payment_status: 'paid', join_date: '2017-05-25', expiry_date: null },
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  const secret = req.headers['x-setup-secret'];
  if (!process.env.SETUP_SECRET || secret !== process.env.SETUP_SECRET) {
    return sendJson(res, 401, { error: 'Invalid or missing setup secret' });
  }
  const body = await readJson(req);

  for (const ddl of SCHEMA) await db.query(ddl);

  // Seed members only if the table is empty.
  let seeded = 0;
  const { rows: cnt } = await db.query('SELECT COUNT(*) AS n FROM members');
  if (Number(cnt[0].n) === 0) {
    for (const m of SAMPLE) {
      const now = new Date().toISOString();
      await db.query(
        `INSERT INTO members (id, full_name, email, phone, dojo, rank, membership_type, status, payment_status, join_date, expiry_date, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [crypto.randomUUID(), m.full_name, m.email, m.phone, m.dojo, m.rank, m.membership_type, m.status, m.payment_status, m.join_date, m.expiry_date, '', now, now]
      );
      seeded++;
    }
  }

  // Create the first admin (from request body or env).
  let adminCreated = false;
  const name = body.name || process.env.ADMIN_NAME;
  const email = String(body.email || process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = body.password || process.env.ADMIN_PASSWORD;
  if (email && password) {
    const { rows: ex } = await db.query('SELECT id FROM admins WHERE email=$1', [email]);
    if (ex.length === 0) {
      await db.query(
        'INSERT INTO admins (id, name, email, password_hash, created_at) VALUES ($1,$2,$3,$4,$5)',
        [crypto.randomUUID(), name || email, email, await hash(password), new Date().toISOString()]
      );
      adminCreated = true;
    }
  }

  const { rows: mc } = await db.query('SELECT COUNT(*) AS n FROM members');
  const { rows: ac } = await db.query('SELECT COUNT(*) AS n FROM admins');
  sendJson(res, 200, { ok: true, seeded, adminCreated, members: Number(mc[0].n), admins: Number(ac[0].n) });
};
