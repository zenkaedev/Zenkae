// src/ui/recruit/settings.classes.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { recruitStore, type Class } from '../../modules/recruit/store.js';
import { ids } from '../ids.js';
import { buildScreen, replyV2Notice } from '../v2.js';

/** Renderiza a tela de gestão de classes */
export function renderClassesSettingsUI(classes: Class[]) {
  const bodyLines =
    classes.length > 0
      ? classes.map((c) => `• ${c.emoji || '▫️'} **${c.name}** ${c.roleId ? `(<@&${c.roleId}>)` : ''}`)
      .join('\n')
      : '_Nenhuma classe configurada ainda._';

  const components: ActionRowBuilder<ButtonBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.recruit.classCreate).setLabel('Adicionar Classe').setStyle(ButtonStyle.Success),
    ),
  ];

  // Adiciona botões de editar/remover para cada classe
  for (const c of classes) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(ids.recruit.classEdit(c.id)).setLabel(`Editar ${c.name}`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(ids.recruit.classRemove(c.id)).setLabel('Remover').setStyle(ButtonStyle.Danger),
      ),
    );
  }

  return buildScreen({
    title: 'Recrutamento — Gestão de Classes',
    body: bodyLines,
    components, // Passa os componentes diretamente
    back: { id: 'recruit:settings' },
  });
}

/** Abre o modal para criar ou editar uma classe */
export async function openClassModal(inter: ButtonInteraction, classToEdit?: Class) {
  const isEditing = !!classToEdit;
  const modal = new ModalBuilder()
    .setCustomId(isEditing ? ids.recruit.modalClassUpdate(classToEdit.id) : ids.recruit.modalClassSave)
    .setTitle(isEditing ? 'Editar Classe' : 'Nova Classe');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('Nome da Classe').setRequired(true).setStyle(TextInputStyle.Short).setValue(classToEdit?.name ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (opcional)').setRequired(false).setStyle(TextInputStyle.Short).setValue(classToEdit?.emoji ?? ''),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('roleId').setLabel('ID do Cargo (opcional)').setRequired(false).setStyle(TextInputStyle.Short).setValue(classToEdit?.roleId ?? ''),
    ),
  );
  await inter.showModal(modal);
}

/** Processa o envio do modal de classe */
export async function handleClassModalSubmit(inter: ModalSubmitInteraction, classId?: string) {
  if (!inter.inGuild()) return;
  const name = inter.fields.getTextInputValue('name').trim();
  const emoji = inter.fields.getTextInputValue('emoji').trim() || null;
  const roleId = inter.fields.getTextInputValue('roleId').trim() || null;

  const settings = await recruitStore.getSettings(inter.guildId);
  const classes = recruitStore.parseClasses(settings.classes);

  if (classId) { // Editando
    const index = classes.findIndex((c) => c.id === classId);
    if (index > -1) {
      classes[index] = { ...classes[index], name, emoji, roleId };
    }
  } else { // Criando
    classes.push({ id: randomUUID(), name, emoji, roleId });
  }

  await recruitStore.updateSettings(inter.guildId, { classes: recruitStore.stringifyClasses(classes) as any });
  await inter.update(renderClassesSettingsUI(classes));
}

/** Remove uma classe */
export async function handleClassRemove(inter: ButtonInteraction, classId: string) {
    if (!inter.inGuild()) return;
    const settings = await recruitStore.getSettings(inter.guildId);
    let classes = recruitStore.parseClasses(settings.classes);
    classes = classes.filter(c => c.id !== classId);

    await recruitStore.updateSettings(inter.guildId, { classes: recruitStore.stringifyClasses(classes) as any });
    await inter.update(renderClassesSettingsUI(classes));
}
