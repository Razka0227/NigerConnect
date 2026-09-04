# Niger Connect 🇳🇪

Super-app locale façon « mini WeChat » : **messagerie temps réel, petites annonces, transport, paiement mobile money, actualités** — pensée pour le Niger et conçue pour fonctionner avec **peu de data** et en **mode dégradé** (zones à connectivité faible).

## Architecture

```
NigerConnect/
├── server/                 # Backend Node.js + Express + Socket.IO + Prisma
│   ├── prisma/
│   │   ├── schema.prisma   # SQLite (bascule PostgreSQL = 1 ligne .env)
│   │   └── seed.js         # Données de démo (Niamey, Zinder, Maradi…)
│   └── src/
│       ├── index.js        # Bootstrap Express + Socket.IO (gzip, rate-limit)
│       ├── socket/         # Temps réel : message:send, typing, read, presence
│       └── routes/         # auth, users, conversations, messages, ads,
│                           # transport, payments, news
└── client/                 # Angular 22 PWA (offline-first, mobile-first)
    └── src/app/
        ├── core/           # services (API, auth, socket, Dexie, offline, chat)
        ├── features/       # auth, home, chat, ads, transport, payments, news, profile
        └── shared/         # pipes, avatar, empty-state
```

- **Langages** : TypeScript / Angular 22 (frontend) · Node.js 20+ (backend)
- **Temps réel** : Socket.IO (WebSocket + fallback long-polling automatique)
- **Base de données** : SQLite via Prisma en dev → PostgreSQL en prod
  (Cassandra prévu pour le volume messages à grande échelle)
- **Offline-first** : IndexedDB (Dexie) + Service Worker PWA + file d'envoi

## Démarrage rapide

Prérequis : Node.js ≥ 20.

```bash
npm install --prefix server          # dépendances backend
npm install --prefix client          # dépendances frontend

# 1. Préparer la base + données de démo
cd server
npx prisma db push
node prisma/seed.js                  # 6 comptes, annonces, trajets, news, messages

# 2. Lancer le backend (port 4000)
npm run dev

# 3. Lancer le frontend (port 4200)
cd ../client
npm start
```

Ouvrez `http://localhost:4200`.

### Comptes de démo (code OTP : `123456` en dev)

| Téléphone        | Nom              | Rôle       |
|------------------|------------------|------------|
| +227 90 00 00 01 | Aïcha Garba      | utilisateur|
| +227 90 00 00 02 | Moussa Oumarou   | utilisateur|
| +227 90 00 00 04 | Ibrahim Seyni    | conducteur |
| +227 90 00 00 05 | Salifou Boureima | conducteur |

Le code OTP est aussi affiché dans la console du serveur à chaque demande.

## Test de bout en bout

```bash
# terminal 1 — serveur allumé (npm run dev dans server/)
node scripts/e2e.mjs
```

Vérifie : auth OTP, conversation, message temps réel, idempotence `clientMsgId`,
paiement (dépôt + transfert), annonces, actualités, trajets et réservation.

## Fonctionnalités & optimisations pour le Niger

### 1. Messagerie offline-first
- Messages envoyés hors ligne **mis en file (IndexedDB)** et envoyés automatiquement à la reconnexion.
- **Idempotence** par `clientMsgId` : pas de doublon même si le client retente.
- Temps réel WebSocket avec **fallback long-polling** quand le WebSocket est bloqué (réseaux 2G/3G).
- Confirmations de lecture, indicateur « en train d'écrire », présence en ligne.

### 2. Paiement mobile money (démo)
- Recharge simulée Orange Money / Moov Money / Airtel Money (en prod : API opérateurs / push USSD).
- Portefeuille interne + transfert entre utilisateurs.
- USSD des opérateurs affichés (#144#, #555#, #122#).

### 3. Transport
- Covoiturage inter-villes (Niamey–Zinder, Niamey–Tahoua…) : publication de trajet, réservation de place, validation par le conducteur.

### 4. Petites annonces
- Catégories locales (véhicules 4x4, immobilier, agriculture…), publication, contact vendeur, statut vendu/archivé.

### 5. Actualités
- Flux léger (résumés) + mode dégradé : les images ne sont pas chargées en 2G.

### 6. Mode dégradé / économie de données
- **Détection automatique** 2G/3G (`navigator.connection.effectiveType`) + bannière.
- **Compression gzip** côté serveur, payloads minimisés.
- **Cache API** (Dexie) : les annonces/actualités restent lisibles hors ligne.
- **PWA installable** : fonctionne depuis l'écran d'accueil sans connexion.

## Points d'entrée API

| Méthode | Route                          | Description                          |
|---------|--------------------------------|--------------------------------------|
| POST    | `/api/auth/request-otp`        | Envoi d'un code OTP SMS              |
| POST    | `/api/auth/verify-otp`         | Vérification + JWT                   |
| GET     | `/api/conversations`           | Liste des conversations              |
| POST    | `/api/messages`                | Envoi/sync (idempotent)              |
| GET     | `/api/ads` · `/api/rides` · `/api/news` · `/api/payments/*` | — |

## Passer à PostgreSQL en production

```bash
# server/.env
DATABASE_URL="postgresql://user:pass@host:5432/nigerconnect"
npx prisma db push
```

## Prochaines étapes proposées

- [ ] Empaquetage Android/iOS via **Capacitor**
- [ ] Notifications push (FCM) pour messages hors ligne
- [ ] Cassandra pour l'historique de messages volumineux
- [ ] Images compressées côté serveur (thumbnail 200px pour low-data)
- [ ] Envoi réel SMS (passerelle USSD / agrégateur local)
- [ ] Multilingue français / haoussa / zarma / tamasheq
- [ ] Mode « zones blanches » : relais de données via proximité (Bluetooth)
