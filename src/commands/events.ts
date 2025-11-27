import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  ButtonInteraction,
} from 'discord.js';
import { ids } from '../ui/ids.js';
import { openNewEventModal } from '../modules/events/panel.js';

export const data = new SlashCommandBuilder()
  .setName('evento')
  .setDescription('Cria um novo evento para o servidor.');

export async function execute(interaction: ChatInputCommandInteraction) {
  // O modal precisa ser aberto via botão ou comando direto.
  // Como showModal só funciona se não houve reply/defer, vamos usar um botão intermediário
  // se o comando demorar, mas o ideal é chamar direto.

  // Slash commands permitem showModal direto se não deferido.
  // Vamos tentar chamar direto.

  // Hack: O discord.js tipa showModal apenas em alguns lugares, mas funciona em ChatInput.
  // Porém, se o comando for global, pode ter delay.
  // Vamos criar um botão "Criar Evento" efêmero para garantir a interação limpa.

  await interaction.reply({
    content: 'Clique abaixo para iniciar a criação do evento.',
    components: [
      {
        type: 1, // ActionRow
        components: [
          {
            type: 2, // Button
            style: 1, // Primary
            label: 'Criar Evento',
            custom_id: ids.events.new,
            emoji: { name: '📅' },
          },
        ],
      },
    ],
    ephemeral: true,
  });
}

// Handler para o botão de início (deve ser chamado pelo router de interação)
export async function handleStartCreation(interaction: ButtonInteraction) {
  await openNewEventModal(interaction);
}
