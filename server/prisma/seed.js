import { PrismaClient } from '@prisma/client';
import { config } from '../src/config.js';
import { randomPin, normalizePhone } from '../src/utils.js';

const prisma = new PrismaClient();

const USERS = [
  { phone: '+22790000001', name: 'Aïcha Garba', role: 'user' },
  { phone: '+22790000002', name: 'Moussa Oumarou', role: 'user' },
  { phone: '+22790000003', name: 'Fatima Diallo', role: 'user' },
  { phone: '+22790000004', name: 'Ibrahim Seyni', role: 'driver' },
  { phone: '+22790000005', name: 'Salifou Boureima', role: 'driver' },
  { phone: '+22790000006', name: 'Hawa Maiga', role: 'user' },
];

const NEWS = [
  {
    category: 'niger', title: 'Le Niger lance un programme national d’irrigation',
    summary: 'Un nouveau programme vise à sécuriser 50 000 hectares de terres agricoles dans la vallée du fleuve Niger.',
    body: 'Le gouvernement a annoncé le lancement d’un programme national d’irrigation dans plusieurs régions, avec pour objectif de renforcer la sécurité alimentaire et de soutenir les petits exploitants agricoles. Les travaux débuteront dans les vallées du fleuve Niger, de la Maggia et de la Korama.',
    source: 'Niger Connect News',
  },
  {
    category: 'economie', title: 'La monnaie mobile progresse fortement au Niger',
    summary: 'Les transactions de monnaie mobile ont bondi de 40 % en un an, portées par Orange Money, Moov Money et Airtel Money.',
    body: 'Les services de paiement mobile connaissent une croissance record au Niger. Selon les derniers chiffres des opérateurs, plus de 8 millions de Nigériens utilisent désormais la monnaie mobile pour leurs transactions quotidiennes.',
    source: 'Niger Connect News',
  },
  {
    category: 'tech', title: 'Un hackathon pour les solutions agricoles numériques à Niamey',
    summary: 'Développeurs et agritech se réunissent à Niamey pour concevoir des solutions accessibles hors ligne.',
    body: 'Le hackathon « AgriTech Sahel » rassemble des développeurs, agronomes et entrepreneurs à Niamey. Les projets primés devront fonctionner en mode dégradé, sans connexion internet stable.',
    source: 'Niger Connect News',
  },
  {
    category: 'sport', title: 'La sélection nationale prépare la prochaine CAN',
    summary: 'Le staff technique élargit la liste des joueurs appelés pour la préparation de la Coupe d’Afrique des Nations.',
    body: 'La Fédération a publié une liste élargie de joueurs convoqués pour le prochain stage de préparation. Les supporters attendent avec impatience les premiers matchs amicaux.',
    source: 'Niger Connect News',
  },
  {
    category: 'general', title: 'Campagne de sensibilisation sur la sécurité routière',
    summary: 'Une campagne nationale rappelle les règles de sécurité sur les axes Niamey–Zinder et Niamey–Tahoua.',
    body: 'Les autorités intensifient les contrôles et lancent une campagne de sensibilisation auprès des conducteurs et des motos-taxis dans les grandes villes du pays.',
    source: 'Niger Connect News',
  },
  {
    category: 'agriculture', title: 'Les prix du mil et du sorgho restent stables sur les marchés de Niamey',
    summary: 'Les marchés de Niamey affichent une stabilité des prix des céréales de base, bonne nouvelle pour les ménages.',
    body: 'Les prix du mil et du sorgho sont restés globalement stables cette semaine sur les principaux marchés de Niamey. Les commerçants notent une bonne disponibilité des stocks.',
    source: 'Niger Connect News',
  },
];

const ADS = [
  { seller: 0, category: 'vehicules', title: 'Toyota Land Cruiser 2005, très bon état', description: 'Véhicule 4x4 robuste, idéal pour les pistes. Climatisation fonctionnelle, 2 pneus neufs.', price: 8500000, city: 'Niamey', images: '[]' },
  { seller: 2, category: 'immobilier', title: 'Maison 3 chambres à Yantala', description: 'Cour spacieuse, forage privé, électricité. Proche du grand marché.', price: 25000000, city: 'Niamey', images: '[]' },
  { seller: 1, category: 'electronique', title: 'iPhone 11 128 Go, débloqué', description: 'Téléphone en très bon état, batterie 90 %. Livré avec chargeur.', price: 175000, city: 'Zinder', images: '[]' },
  { seller: 5, category: 'agriculture', title: 'Sac de mil (100 kg)', description: 'Millet de qualité supérieure, récolte récente de la région de Maradi.', price: 28000, city: 'Maradi', images: '[]' },
  { seller: 0, category: 'emploi', title: 'Vendeur/vendeuse boutique de téléphonie', description: 'CDI, salaire + commissions. Expérience de 1 an souhaitée. Envoyez votre CV.', price: 90000, city: 'Niamey', images: '[]' },
];

const RIDES = [
  { driver: 3, from: 'Niamey', to: 'Zinder', daysFromNow: 2, price: 6000, seats: 3, vehicle: 'Toyota Hiace' },
  { driver: 4, from: 'Niamey', to: 'Tahoua', daysFromNow: 3, price: 4000, seats: 4, vehicle: 'Berline' },
  { driver: 3, from: 'Zinder', to: 'Diffa', daysFromNow: 4, price: 5000, seats: 3, vehicle: '4x4' },
];

async function main() {
  console.log('[seed] nettoyage de la base…');
  await prisma.message.deleteMany();
  await prisma.conversationUser.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.rideRequest.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.newsItem.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.user.deleteMany();

  console.log('[seed] création des utilisateurs…');
  const created = [];
  for (const u of USERS) {
    const user = await prisma.user.create({
      data: {
        phone: normalizePhone(u.phone),
        name: u.name,
        username: u.name.toLowerCase().replace(/\s+/g, '.'),
        role: u.role,
        isVerified: true,
      },
    });
    await prisma.wallet.create({
      data: { userId: user.id, balance: 250000 },
    });
    created.push(user);
  }

  console.log('[seed] actualités…');
  for (const n of NEWS) {
    await prisma.newsItem.create({
      data: {
        category: n.category, title: n.title, summary: n.summary,
        body: n.body, source: n.source,
        publishedAt: new Date(Date.now() - Math.floor(Math.random() * 5) * 3600_000),
      },
    });
  }

  console.log('[seed] annonces…');
  for (const a of ADS) {
    await prisma.ad.create({
      data: {
        sellerId: created[a.seller].id,
        category: a.category, title: a.title, description: a.description,
        price: a.price, city: a.city, images: a.images,
      },
    });
  }

  console.log('[seed] trajets…');
  const rideList = [];
  for (const r of RIDES) {
    const ride = await prisma.ride.create({
      data: {
        driverId: created[r.driver].id,
        from: r.from, to: r.to,
        departAt: new Date(Date.now() + r.daysFromNow * 24 * 3600_000),
        pricePerSeat: r.price, seatsTotal: r.seats, seatsLeft: r.seats,
        vehicle: r.vehicle,
      },
    });
    rideList.push(ride);
  }

  console.log('[seed] conversation + messages de démo…');
  const conv = await prisma.conversation.create({
    data: {
      type: 'direct',
      users: { create: [{ userId: created[0].id }, { userId: created[1].id }] },
    },
  });
  const demoMsgs = [
    { sender: 0, body: 'Barka ! Tu peux me recommander un bon vendeur de riz à Niamey ?', minutes: 90 },
    { sender: 1, body: 'Salam, oui bien sûr. Va voir Moussa au marché de Katako, coin téléphonie.', minutes: 80 },
    { sender: 0, body: 'Merci ! Je vais y passer demain matin.', minutes: 75 },
    { sender: 1, body: 'Parfait. Dis-lui que tu viens de ma part.', minutes: 60 },
  ];
  for (let i = 0; i < demoMsgs.length; i += 1) {
    const m = demoMsgs[i];
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: created[m.sender].id,
        clientMsgId: `seed-${i}-${Date.now()}`,
        body: m.body,
        createdAt: new Date(Date.now() - m.minutes * 60_000),
      },
    });
  }

  console.log('[seed] terminé ✔');
  console.log(`  Comptes de démo (OTP dev: ${config.otpAlwaysCode} ou le code affiché au login):`);
  for (const u of created) {
    console.log(`   ${u.phone}  ${u.name}  [${u.role}]`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
