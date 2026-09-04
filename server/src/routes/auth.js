import { Router } from 'express';
import { prisma } from '../db.js';
import { config, isProd } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { randomPin, signToken, publicUser, ok, fail, normalizePhone } from '../utils.js';

const router = Router();

// POST /api/auth/request-otp  { phone, countryCode? }
// Sends (or simulates) an SMS/OTP. In production, plug in an SMS gateway.
router.post('/request-otp', async (req, res) => {
  const { phone, countryCode } = req.body || {};
  const normalized = normalizePhone(phone, countryCode);
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    return fail(res, 400, 'Numéro de téléphone invalide');
  }

  const code = isProd() ? randomPin(6) : randomPin(6);
  const expiresAt = new Date(Date.now() + config.otpTtlMs);

  await prisma.otpCode.create({
    data: { phone: normalized, code, purpose: 'login', expiresAt },
  });

  // TODO(prod): integrate SMS gateway (e.g. SMS Market Nigeria/Niger, Twilio, local USSD).
  console.log(`[OTP] ${normalized} -> ${code} (expires ${expiresAt.toISOString()})`);

  return ok(res, {
    phone: normalized,
    expiresIn: config.otpTtlMs / 1000,
    // Dev convenience only – never expose in production.
    devCode: isProd() ? undefined : code,
  });
});

// POST /api/auth/verify-otp  { phone, code }
router.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body || {};
  const normalized = normalizePhone(phone);
  if (!code) return fail(res, 400, 'Code OTP requis');

  const otp = await prisma.otpCode.findFirst({
    where: { phone: normalized, code, purpose: 'login', usedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) return fail(res, 400, 'Code invalide');
  if (otp.expiresAt < new Date()) return fail(res, 400, 'Code expiré, demandez-en un nouveau');

  await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

  let user = await prisma.user.findUnique({ where: { phone: normalized } });
  const isNew = !user;
  if (!user) {
    user = await prisma.user.create({
      data: { phone: normalized },
    });
  }
  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, balance: 0 },
  });

  return ok(res, {
    user: publicUser(user),
    token: signToken(user),
    isNew,
  });
});

// GET /api/auth/me  (auth)
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return fail(res, 404, 'Utilisateur introuvable');
  return ok(res, publicUser(user));
});

// PATCH /api/auth/me  (auth)  { name?, username?, language?, avatarUrl? }
router.patch('/me', requireAuth, async (req, res) => {
  const { name, username, language, avatarUrl } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = String(name).slice(0, 80);
  if (language !== undefined) data.language = String(language).slice(0, 8);
  if (avatarUrl !== undefined) data.avatarUrl = String(avatarUrl).slice(0, 500);
  if (username !== undefined) {
    data.username = String(username).trim().toLowerCase().slice(0, 30);
    if (!/^[a-z0-9_.]+$/.test(data.username)) {
      return fail(res, 400, 'Nom d’utilisateur invalide (lettres, chiffres, _ et . uniquement)');
    }
  }
  if (Object.keys(data).length === 0) return fail(res, 400, 'Aucune donnée à modifier');

  try {
    const user = await prisma.user.update({ where: { id: req.user.sub }, data });
    return ok(res, publicUser(user));
  } catch (e) {
    if (e?.code === 'P2002') return fail(res, 409, 'Ce nom d’utilisateur est déjà pris');
    throw e;
  }
});

export default router;
