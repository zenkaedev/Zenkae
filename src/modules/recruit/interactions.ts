import { InteractionRouter } from '../../infra/router.js';
import { assertStaff } from '../../guards/staff.js';
import { ids } from '../../ui/ids.js';
import { PUB_IDS } from '../../ui/recruit/panel.public.js';
import { handleError } from '../../infra/errors.js';
import { renderDashboard, type DashTab } from '../../container.js';
import { safeUpdate } from '../../ui/v2.js';
import type { FilterKind } from './types.js';
import { MessageFlags, ActionRowBuilder, RoleSelectMenuBuilder, type StringSelectMenuInteraction } from 'discord.js';

// Controllers / Handlers
import {
    handlePublishRecruitPanel as handlePublishLegacy,
    openApplyModal,
    handleApplyModalSubmit,
    openRecruitSettings,
    openEditFormModal,
    handleEditFormSubmit,
    openAppearanceModal,
    handleAppearanceSubmit,
    openDMTemplatesModal,
    handleDMTemplatesSubmit,
    openSelectPanelChannel,
    openSelectFormsChannel,
    handleSelectChannel,
    openApplyQuestionsModal,
    handleApplyQuestionsSubmit,
    handleDecisionApprove,
    handleDecisionRejectOpen,
    handleDecisionRejectSubmit,
} from './panel.js';

import { recruitStore } from './store.js';

import {
    openRecruitClassesSettings,
    openClassModal,
    handleClassModalSubmit,
    handleClassRemove,
    handleClassesSelect,
} from '../../ui/recruit/settings.classe.js';

import {
    publishPublicRecruitPanelV2,
    handleClassSelect,
    openNickModal,
    handleNickModalSubmit,
    handleStartClick,
    handleApplyQuestionsSubmit as handleApplyQuestionsSubmitPublic,
} from '../../ui/recruit/panel.public.js';

export const recruitRouter = new InteractionRouter();

// --- DASHBOARD NAVIGATION & FILTER ---
recruitRouter.select(ids.recruit.filter, async (i) => {
    const choice = i.values[0] as FilterKind;
    const base = await renderDashboard({
        tab: 'recruit',
        guildId: i.guildId!,
        filter: choice,
    });
    // @ts-ignore
    await safeUpdate(i, base);
});

// --- STAFF ACTIONS ---
recruitRouter.button(ids.recruit.publish, async (i) => {
    if (!(await assertStaff(i))) return;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await publishPublicRecruitPanelV2(i);
    await i.editReply({ content: '✅ Painel de recrutamento publicado/atualizado.' });
});

// Settings & Config
recruitRouter.button('recruit:settings', async (i) => {
    if (!(await assertStaff(i))) return;
    await openRecruitSettings(i);
});

// Clear Completed Applications
recruitRouter.button('recruit:clear-completed', async (i) => {
    if (!(await assertStaff(i))) return;
    await i.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await recruitStore.clearCompleted(i.guildId!);
    await i.editReply({
        content: `✅ ${result.count} candidatura(s) finalizada(s) removida(s).\n\n💡 Volte ao dashboard para ver a lista atualizada.`
    });
});

// Settings: Forms
recruitRouter.button(ids.recruit.settingsForm, async (i) => {
    if (!(await assertStaff(i))) return;
    await openEditFormModal(i);
});
recruitRouter.modal(ids.recruit.modalForm, async (i) => {
    if (!(await assertStaff(i))) return;
    // ensureDeferredModal is handled inside handler or we add it here?
    // Legacy code used ensureDeferredModal inside listener. 
    // We should probably standardize. For now calling handler directly which might expect deferral.
    await handleEditFormSubmit(i);
});

// Settings: Appearance
recruitRouter.button(ids.recruit.settingsAppearance, async (i) => {
    if (!(await assertStaff(i))) return;
    await openAppearanceModal(i);
});
recruitRouter.modal(ids.recruit.modalAppearance, async (i) => {
    if (!(await assertStaff(i))) return;
    await handleAppearanceSubmit(i);
});

// Settings: DM
recruitRouter.button(ids.recruit.settingsDM, async (i) => {
    if (!(await assertStaff(i))) return;
    await openDMTemplatesModal(i);
});
recruitRouter.modal(ids.recruit.modalDM, async (i) => {
    if (!(await assertStaff(i))) return;
    await handleDMTemplatesSubmit(i);
});

// Settings: Approved Role
recruitRouter.button('recruit:settings:approved-role', async (i) => {
    if (!(await assertStaff(i))) return;

    // Defer to prevent timeout and fetch all roles
    await i.deferReply({ flags: MessageFlags.Ephemeral });

    // Force fetch all guild roles to populate cache
    await i.guild?.roles.fetch();

    const select = new RoleSelectMenuBuilder()
        .setCustomId('recruit:settings:select:approved-role')
        .setPlaceholder('Escolha o cargo dado ao aprovar');

    await i.editReply({
        content: '👤 **Selecione o cargo padrão de aprovação:**\n\nEste cargo será dado automaticamente quando você aprovar uma candidatura.',
        components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select)],
    });
});

recruitRouter.select('recruit:settings:select:approved-role', async (i: any) => {
    if (!(await assertStaff(i))) return;
    await i.deferReply({ flags: MessageFlags.Ephemeral });

    const roleId = i.values?.[0];
    if (!roleId) {
        await i.editReply({ content: '❌ Nenhum cargo selecionado.' });
        return;
    }

    await recruitStore.updateSettings(i.guildId!, { defaultApprovedRoleId: roleId });
    await i.editReply({ content: `✅ Cargo de aprovado definido: <@&${roleId}>` });
});

// Settings: Channels
recruitRouter.button(ids.recruit.settingsPanelChannel, async (i) => {
    if (!(await assertStaff(i))) return;
    await openSelectPanelChannel(i);
});
recruitRouter.button(ids.recruit.settingsFormsChannel, async (i) => {
    if (!(await assertStaff(i))) return;
    await openSelectFormsChannel(i);
});
recruitRouter.select(ids.recruit.selectPanelChannel, async (i) => {
    if (!(await assertStaff(i))) return;
    // Cast generic select to channel select (not strict here but works at runtime)
    await handleSelectChannel(i as any, 'panel');
});
recruitRouter.select(ids.recruit.selectFormsChannel, async (i) => {
    if (!(await assertStaff(i))) return;
    await handleSelectChannel(i as any, 'forms');
});

// --- CLASSES ---
recruitRouter.select(ids.recruit.settingsClasses, async (i) => {
    if (!(await assertStaff(i))) return;
    await handleClassesSelect(i as unknown as StringSelectMenuInteraction);
});
recruitRouter.button(ids.recruit.settingsClasses, async (i) => {
    if (!(await assertStaff(i))) return;
    await openRecruitClassesSettings(i);
});
recruitRouter.button(new RegExp('^recruit:settings:class:edit:'), async (i) => {
    if (!(await assertStaff(i))) return;
    await openClassModal(i, i.customId.split(':').pop()!);
});
recruitRouter.button(new RegExp('^recruit:settings:class:remove:'), async (i) => {
    if (!(await assertStaff(i))) return;
    await handleClassRemove(i, i.customId.split(':').pop()!);
});
recruitRouter.button(ids.recruit.classCreate, async (i) => {
    if (!(await assertStaff(i))) return;
    await openClassModal(i);
});

// Modal Save (Create)
recruitRouter.modal(ids.recruit.modalClassSave, async (i) => {
    if (!(await assertStaff(i))) return;
    await handleClassModalSubmit(i);
});
// Modal Update (Edit)
recruitRouter.modal(new RegExp('^recruit:settings:class:update:'), async (i) => {
    if (!(await assertStaff(i))) return;
    await handleClassModalSubmit(i);
});

// --- PUBLIC FLOW ---
recruitRouter.button(ids.recruit.apply, async (i) => {
    await openApplyModal(i);
});
recruitRouter.modal('recruit:apply:modal', async (i) => {
    await handleApplyModalSubmit(i);
});
recruitRouter.button(new RegExp('^recruit:apply:q:open:'), async (i) => {
    await openApplyQuestionsModal(i, i.customId.split(':').pop()!);
});
recruitRouter.modal(new RegExp('^recruit:apply:q:modal:'), async (i) => {
    await handleApplyQuestionsSubmit(i, i.customId.split(':').pop()!);
});

// V2 Public
recruitRouter.select(PUB_IDS.classSelect, async (i) => {
    await handleClassSelect(i as unknown as StringSelectMenuInteraction);
});
recruitRouter.button(PUB_IDS.nickOpen, async (i) => {
    await openNickModal(i);
});
recruitRouter.modal(PUB_IDS.nickModal, async (i) => {
    await handleNickModalSubmit(i);
});
recruitRouter.button(PUB_IDS.start, async (i) => {
    await handleStartClick(i);
});
recruitRouter.modal(new RegExp('^' + PUB_IDS.applyQModalPrefix), async (i) => {
    await handleApplyQuestionsSubmitPublic(i);
});


// --- DECISIONS (Approve/Reject) ---
recruitRouter.button(new RegExp('^recruit:decision:approve:'), async (i) => {
    if (!(await assertStaff(i))) return;
    await handleDecisionApprove(i, i.customId.split(':').pop()!);
});
recruitRouter.button(new RegExp('^recruit:decision:reject:'), async (i) => {
    if (!(await assertStaff(i))) return;
    await handleDecisionRejectOpen(i, i.customId.split(':').pop()!);
});
recruitRouter.modal(new RegExp('^recruit:decision:reject:modal:'), async (i) => {
    if (!(await assertStaff(i))) return;
    await handleDecisionRejectSubmit(i, i.customId.split(':').pop()!);
});
