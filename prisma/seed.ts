import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const guildId = process.env.DEV_GUILD_ID;
  if (!guildId) {
    console.log('⚠️ Defina DEV_GUILD_ID no .env para semear candidatos.');
    return;
  }

  // limpa atuais (opcional)
  await prisma.application.deleteMany({ where: { guildId } });

  const data = [
    { userId: '100000000000000001', username: 'player_one',   nick: 'PlayerOne',   className: 'Guerreiro', status: 'pending' },
    { userId: '100000000000000002', username: 'mage_two',     nick: 'ArcanoX',     className: 'Mago',      status: 'pending' },
    { userId: '100000000000000003', username: 'archer_three', nick: 'FlechaViva',  className: 'Arqueiro',  status: 'approved' },
  ];

  await prisma.application.createMany({
    data: data.map(d => ({
      guildId,
      ...d,
    })),
  });

  console.log(`✅ Seed concluído para guild ${guildId} (${data.length} linhas).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
