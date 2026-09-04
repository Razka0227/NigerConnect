import { io } from 'socket.io-client';
import { createRequire } from 'node:module';

const BASE = 'http://localhost:4000';

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function login(phone) {
  const otp = await api('POST', '/api/auth/request-otp', { phone });
  const code = otp.data.devCode;
  const v = await api('POST', '/api/auth/verify-otp', { phone: `+227${phone}`, code });
  return v.data;
}

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? '✔' : '✘ FAIL'} ${name}`);
  if (!cond) failures += 1;
}

const userA = await login('90000001'); // Aïcha
const userB = await login('90000002'); // Moussa

check('auth A', !!userA.token);
check('auth B', !!userB.token);

// socket B listens for incoming message
const socketB = io(BASE, { auth: { token: userB.token }, transports: ['websocket'] });
const received = new Promise((resolve) => socketB.on('message:new', (m) => resolve(m)));
await new Promise((r) => socketB.on('connect', r));

// A opens a conversation with B and sends a message
const conv = await api('POST', '/api/conversations', { userId: userB.user.id }, userA.token);
check('conversation créée', !!conv.data.id);

// B joins the conversation room (like the chat window does)
await new Promise((resolve) => socketB.emit('conversation:join', conv.data.id, resolve));

const ack = await new Promise((resolve) => {
  const s = io(BASE, { auth: { token: userA.token }, transports: ['websocket'] });
  s.on('connect', () => {
    s.emit('message:send', {
      conversationId: conv.data.id,
      clientMsgId: `e2e-${Date.now()}`,
      type: 'text',
      body: 'Salam, test temps réel ✓',
    }, (res) => { s.disconnect(); resolve(res); });
  });
});
check('message envoyé (ack ok)', ack?.ok === true && !!ack.data?.id);

const msg = await Promise.race([received, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
check('B reçoit le message en temps réel', msg?.body === 'Salam, test temps réel ✓');

// idempotency: re-send same clientMsgId via REST
const dup = await api('POST', '/api/messages', {
  conversationId: conv.data.id,
  clientMsgId: ack.data.clientMsgId,
  type: 'text',
  body: 'doublon',
}, userA.token);
check('idempotence clientMsgId (pas de doublon)', dup.data.id === ack.data.id);

// offline-first: queue then flush (simulate by posting directly)
const messages = await api('GET', `/api/conversations/${conv.data.id}/messages`, null, userB.token);
check('messages visibles pour B', messages.data.length >= 1);

// payments
const wallet = await api('GET', '/api/payments/wallet', null, userA.token);
check('wallet A', wallet.data.balance > 0);
const dep = await api('POST', '/api/payments/deposit', { amount: 1000, provider: 'orange' }, userA.token);
check('dépôt mobile money', dep.data.status === 'success' && dep.data.amount === 1000);

// transfer A -> B
const tr = await api('POST', '/api/payments/transfer', { recipientId: userB.user.id, amount: 500 }, userA.token);
check('transfert A→B', tr.data.type === 'debit' && tr.data.amount === 500);

// ads & news & rides
const ads = await api('GET', '/api/ads?perPage=5', null, userA.token);
check('annonces seed', ads.data.length >= 3);
const news = await api('GET', '/api/news?perPage=5', null, userA.token);
check('actualités seed', news.data.length >= 4);
const rides = await api('GET', '/api/rides?perPage=5', null, userA.token);
check('trajets seed', rides.data.length >= 2);

// ride request (409 = déjà demandé lors d'un run précédent → idempotence OK)
try {
  const req = await api('POST', `/api/rides/${rides.data[0].id}/request`, { seats: 1 }, userA.token);
  check('réservation place', !!req.data.requestId);
} catch (e) {
  check('réservation place (déjà envoyée → 409 attendu)', e.message.includes('409'));
}

socketB.disconnect();
console.log(failures === 0 ? '\n✅ E2E réussi' : `\n❌ ${failures} test(s) échoué(s)`);
process.exit(failures === 0 ? 0 : 1);
