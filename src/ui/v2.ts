// src/ui/v2.ts
import * as D from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

/** Identidade visual Zenkae */
export const Brand = { purple: 0x6d28d9 as const };

export type ButtonSpec = { id: string; label: string; emoji?: string; disabled?: boolean };

// Compatível com d.js v14 (sem AnySelectMenuBuilder nos typings)
export type SelectSpec =
  | D.StringSelectMenuBuilder
  | D.UserSelectMenuBuilder
  | D.RoleSelectMenuBuilder
  | D.ChannelSelectMenuBuilder
  | D.MentionableSelectMenuBuilder;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function getBuilders() {
  const anyD = D as any;
  const ContainerBuilder = anyD.ContainerBuilder;
  const TextDisplayBuilder = anyD.TextDisplayBuilder;
  const SeparatorBuilder = anyD.SeparatorBuilder;
  const SeparatorSpacingSize = anyD.SeparatorSpacingSize;

  const MediaGalleryBuilder = anyD.MediaGalleryBuilder || anyD.GalleryBuilder;
  const MediaGalleryItemBuilder = anyD.MediaGalleryItemBuilder || anyD.GalleryItemBuilder;

  const addGalleryMethod = (c: any) =>
    typeof c.addMediaGalleryComponents === 'function'
      ? c.addMediaGalleryComponents.bind(c)
      : typeof c.addGalleryComponents === 'function'
        ? c.addGalleryComponents.bind(c)
        : null;

  return {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    addGalleryMethod,
  };
}

/** Carrega banner em assets/<folder>/banner.(png|jpg|jpeg|webp) se existir */
export function loadBannerFrom(
  folder: string,
): { files: D.AttachmentBuilder[]; sources: { source: string; alt?: string }[] } | null {
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  const found = exts
    .map((ext) => ({ abs: path.resolve('assets', folder, `banner.${ext}`), name: `banner.${ext}` }))
    .find((f) => fs.existsSync(f.abs));
  if (!found) return null;

  const file = new D.AttachmentBuilder(found.abs).setName(found.name);
  return {
    files: [file],
    sources: [{ source: `attachment://${found.name}`, alt: 'Zenkae' }],
  };
}

/** Fallback padrão: assets/dashboard/banner.* */
export function loadDefaultBanner() {
  return loadBannerFrom('dashboard');
}

/** Tela padrão V2 (banner opcional, título, corpo, divisor e botões cinza) */
export function buildScreen(opts: {
  title: string;
  subtitle?: string;
  body?: string;
  buttons?: ButtonSpec[];
  selects?: SelectSpec[];
  back?: ButtonSpec | null;
  accentColor?: number | null;
  banner?: { files: D.AttachmentBuilder[]; sources: { source: string; alt?: string }[] } | null;
}) {
  const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    addGalleryMethod,
  } = getBuilders();

  if (!ContainerBuilder || !TextDisplayBuilder || !SeparatorBuilder) {
    throw new Error(
      'Sua versão de discord.js não possui Components V2 (Container/TextDisplay/Separator).',
    );
  }

  const container = new (ContainerBuilder as any)().setAccentColor(
    opts.accentColor ?? Brand.purple,
  );

  // Banner (MediaGallery), se suportado
  if (opts.banner?.sources?.length && MediaGalleryBuilder && MediaGalleryItemBuilder) {
    const items = opts.banner.sources.map((s) =>
      new (MediaGalleryItemBuilder as any)().setURL(s.source).setDescription(s.alt ?? ''),
    );
    const gallery = new (MediaGalleryBuilder as any)().addItems(...items);
    const add = addGalleryMethod(container);
    if (add) add(gallery);
  }

  // Cabeçalho e corpo
  (container as any).addTextDisplayComponents(
    new (TextDisplayBuilder as any)().setContent(`# ${opts.title}`),
  );
  if (opts.subtitle)
    (container as any).addTextDisplayComponents(
      new (TextDisplayBuilder as any)().setContent(opts.subtitle),
    );
  if (opts.body)
    (container as any).addTextDisplayComponents(
      new (TextDisplayBuilder as any)().setContent(opts.body),
    );

  // Divisor
  (container as any).addSeparatorComponents(
    new (SeparatorBuilder as any)()
      .setSpacing((SeparatorSpacingSize as any)?.Large ?? 2)
      .setDivider(true),
  );

  // Rows (selects + botões)
  const rows: D.ActionRowBuilder<D.MessageActionRowComponentBuilder>[] = [];

  if (opts.selects?.length) {
    const row = new D.ActionRowBuilder<D.MessageActionRowComponentBuilder>();

    row.setComponents(...opts.selects);
    rows.push(row);
  }

  const btns = opts.buttons ?? [];
  const back = opts.back ? [{ ...opts.back, emoji: opts.back.emoji ?? '↩️' }] : [];
  for (const group of chunk([...btns, ...back], 5)) {
    const row = new D.ActionRowBuilder<D.ButtonBuilder>();
    row.setComponents(
      ...group.map((b) => {
        const builder = new D.ButtonBuilder()
          .setCustomId(b.id)
          .setLabel(b.label)
          .setStyle(D.ButtonStyle.Secondary)
          .setDisabled(!!b.disabled);
        if (b.emoji) builder.setEmoji(b.emoji);
        return builder;
      }),
    );
    rows.push(row as any);
  }

  if (rows.length && typeof (container as any).addActionRowComponents === 'function') {
    (container as any).addActionRowComponents(...rows);
  }

  const components: (
    | D.JSONEncodable<D.APIMessageTopLevelComponent>
    | D.APIMessageTopLevelComponent
  )[] = [container as any];

  return {
    components,
    files: (D as any).MediaGalleryBuilder ? (opts.banner?.files ?? []) : [],
    flags: D.MessageFlags.IsComponentsV2 as number,
  };
}

/** Notice V2 (mínimo: só texto) + reply helper */
export function buildNotice(text: string) {
  const anyD = D as any;
  const ContainerBuilder = anyD.ContainerBuilder;
  const TextDisplayBuilder = anyD.TextDisplayBuilder;
  if (!ContainerBuilder || !TextDisplayBuilder) throw new Error('Components V2 ausente');

  const container = new ContainerBuilder().setAccentColor(Brand.purple);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  const components = [container] as any[];
  return { components, flags: D.MessageFlags.IsComponentsV2 as number };
}

export async function replyV2(
  inter: D.RepliableInteraction,
  payload: { components: any[]; files?: any[]; flags?: number },
  ephemeral = false,
) {
  const flags = (payload.flags ?? 0) | (ephemeral ? D.MessageFlags.Ephemeral : 0);
  if (!inter.deferred && !inter.replied) return inter.reply({ ...payload, flags });
  return inter.editReply({ ...payload, flags });
}
export function replyV2Notice(inter: D.RepliableInteraction, text: string, ephemeral = false) {
  const payload = buildNotice(text);
  return replyV2(inter, payload, ephemeral);
}

/** Helper pra atualizar mensagens de botões/selects com segurança (deferUpdate) */
export async function safeUpdate(interaction: D.RepliableInteraction, base: D.InteractionReplyOptions | any) {
  try {
    if (
      (interaction.isButton() || interaction.isAnySelectMenu()) &&
      interaction.isRepliable()
    ) {
      if (!interaction.deferred && !interaction.replied) {
        try {
          await interaction.deferUpdate();
        } catch {
          // ignore
        }
      }
      return await interaction.editReply(base as any);
    }
    if (interaction.deferred || interaction.replied)
      return await interaction.editReply(base as any);
    return await interaction.reply(base as any);
  } catch (err) {
    // Falha silenciosa ou log
    try {
      await replyV2Notice(interaction, '❌ Não foi possível atualizar a interface.', true);
    } catch { /* ignore */ }
    throw err;
  }
}
