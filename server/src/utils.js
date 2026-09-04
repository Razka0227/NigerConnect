import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from './config.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phone, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function randomPin(length = 6) {
  const digits = [];
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    digits.push(bytes[i] % 10);
  }
  return digits.join('');
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    phone: u.phone,
    countryCode: u.countryCode,
    name: u.name,
    username: u.username,
    avatarUrl: u.avatarUrl,
    language: u.language,
    role: u.role,
    isVerified: u.isVerified,
    createdAt: u.createdAt,
  };
}

export function ok(res, data, meta = {}) {
  return res.json({ ok: true, data, meta });
}

export function fail(res, status, message, extra = {}) {
  return res.status(status).json({ ok: false, error: { message, ...extra } });
}

// Lightweight pagination helper (compressed payloads).
export function paginate(res, rows, { page = 1, perPage = 20, total = 0 } = {}) {
  return ok(res, rows, { page, perPage, total, hasMore: page * perPage < total });
}

// Normalize an incoming phone number to E.164-ish format (default +227 Niger).
// Accepts: 90000001, 090000001, +22790000001, 0022790000001, 90 00 00 01, +227 90 00 00 01
export function normalizePhone(input, countryCode = '+227') {
  let p = String(input || '').trim().replace(/[\s.-]/g, '');
  if (!p) return '';
  if (p.startsWith('+')) return p;
  if (p.startsWith('00')) return `+${p.slice(2)}`;
  // Nigerien national format: leading 0 then 8 digits (09 00 00 00 01)
  if (/^0[89]\d{7}$/.test(p)) return `${countryCode}${p.slice(1)}`;
  // Nigerien mobile numbers: 9x or 8x, 8 digits
  if (/^[89]\d{7}$/.test(p)) return `${countryCode}${p}`;
  return `+${p}`;
}

export function nowIso() {
  return new Date().toISOString();
}
