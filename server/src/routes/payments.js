import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ok, fail, paginate, normalizePhone } from '../utils.js';

const router = Router();
router.use(requireAuth);

const PROVIDERS = ['orange', 'moov', 'airtel', 'nipe'];

function serializeTx(t) {
  let meta = {};
  try { meta = t.meta ? JSON.parse(t.meta) : {}; } catch { /* ignore */ }
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    method: t.method,
    provider: t.provider,
    reference: t.reference,
    meta,
    status: t.status,
    createdAt: t.createdAt,
  };
}

async function getWallet(userId) {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId, balance: 0 } });
  }
  return wallet;
}

// GET /api/payments/wallet
router.get('/wallet', async (req, res) => {
  const wallet = await getWallet(req.user.sub);
  return ok(res, { balance: wallet.balance, currency: wallet.currency });
});

// GET /api/payments/transactions?page=&perPage=
router.get('/transactions', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(Number(req.query.perPage) || 20, 50);
  const [total, txs] = await Promise.all([
    prisma.transaction.count({ where: { userId: req.user.sub } }),
    prisma.transaction.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return paginate(res, txs.map(serializeTx), { page, perPage, total });
});

// POST /api/payments/deposit  { amount, provider, phone }
// Simulates a Mobile Money (Orange/Moov/Airtel) top-up. In prod, call the
// provider API / or initiate a USSD push.
router.post('/deposit', async (req, res) => {
  const { amount, provider, phone } = req.body || {};
  const amt = Math.floor(Number(amount));
  if (!Number.isInteger(amt) || amt < 50 || amt > 1_000_000) {
    return fail(res, 400, 'Montant invalide (min 50 XOF, max 1 000 000 XOF)');
  }
  if (!PROVIDERS.includes(provider)) return fail(res, 400, 'Fournisseur invalide');

  // Simulate provider latency & callback
  const reference = `${provider.toUpperCase()}${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

  const wallet = await getWallet(req.user.sub);
  const tx = await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      userId: req.user.sub,
      type: 'credit',
      amount: amt,
      method: 'mobile_money',
      provider,
      reference,
      meta: JSON.stringify({ phone: normalizePhone(phone || req.user.phone), simulated: true }),
      status: 'success',
    },
  });
  await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: wallet.balance + amt } });

  return ok(res, serializeTx(tx));
});

// POST /api/payments/transfer  { recipientPhone | recipientId, amount, note? }
router.post('/transfer', async (req, res) => {
  const { recipientPhone, recipientId, amount, note } = req.body || {};
  const amt = Math.floor(Number(amount));
  if (!Number.isInteger(amt) || amt <= 0) return fail(res, 400, 'Montant invalide');

  let recipient = null;
  if (recipientId) {
    recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  } else if (recipientPhone) {
    recipient = await prisma.user.findUnique({ where: { phone: normalizePhone(recipientPhone) } });
  }
  if (!recipient) return fail(res, 404, 'Destinataire introuvable');
  if (recipient.id === req.user.sub) return fail(res, 400, 'Envoi à soi-même impossible');

  const wallet = await getWallet(req.user.sub);
  if (wallet.balance < amt) return fail(res, 400, 'Solde insuffisant');

  const recipientWallet = await getWallet(recipient.id);

  const [debitTx] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        walletId: wallet.id,
        userId: req.user.sub,
        type: 'debit',
        amount: amt,
        method: 'wallet',
        provider: null,
        reference: `T${Date.now()}`,
        meta: JSON.stringify({ to: recipient.id, note: note || '' }),
        status: 'success',
      },
    }),
    prisma.wallet.update({ where: { id: wallet.id }, data: { balance: wallet.balance - amt } }),
    prisma.wallet.update({ where: { id: recipientWallet.id }, data: { balance: recipientWallet.balance + amt } }),
    prisma.transaction.create({
      data: {
        walletId: recipientWallet.id,
        userId: recipient.id,
        type: 'credit',
        amount: amt,
        method: 'wallet',
        provider: null,
        reference: `T${Date.now()}R`,
        meta: JSON.stringify({ from: req.user.sub, note: note || '' }),
        status: 'success',
      },
    }),
  ]);

  const io = req.app.get('io');
  io?.to(`user:${recipient.id}`).emit('payment:received', {
    amount: amt,
    from: req.user.sub,
    note: note || '',
  });

  return ok(res, serializeTx(debitTx));
});

// GET /api/payments/providers
router.get('/providers', (req, res) => {
  const list = [
    { id: 'orange', label: 'Orange Money', ussd: '#144#' },
    { id: 'moov', label: 'Moov Money', ussd: '#555#' },
    { id: 'airtel', label: 'Airtel Money', ussd: '#122#' },
    { id: 'nipe', label: 'NIP', ussd: '#144#' },
  ];
  return ok(res, list);
});

export default router;
