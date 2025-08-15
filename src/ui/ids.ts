export type DashTab = 'home' | 'recruit' | 'events' | 'admin';
export type RsvpChoice = 'yes' | 'maybe' | 'no';

function isDashTab(x: any): x is DashTab {
  return x === 'home' || x === 'recruit' || x === 'events' || x === 'admin';
}

export const ids = {
  dash: {
    tab: (tab: DashTab) => `dash:${tab}` as const,
    is: (id: string) => id.startsWith('dash:'),
    parse: (id: string): { tab: DashTab } | null => {
      const parts = id.split(':');
      const tab = parts[1];
      return isDashTab(tab) ? { tab } : null;
    },
  },

  recruit: {
    filter: 'recruit:filter' as const,
    publish: 'recruit:publish' as const,
    apply: 'recruit:apply' as const,

    // Q&A (abrir segundo modal)
    applyQOpen: (appId: string) => `recruit:apply:q:open:${appId}` as const,

    // Configurações
    settingsForm: 'recruit:settings:form' as const,
    settingsPanelChannel: 'recruit:settings:panelChannel' as const,
    settingsFormsChannel: 'recruit:settings:formsChannel' as const,
    settingsAppearance: 'recruit:settings:appearance' as const,
    settingsDM: 'recruit:settings:dm' as const,

    // [NOVO] Gestão de Classes
    settingsClasses: 'recruit:settings:classes' as const,
    classCreate: 'recruit:settings:class:create' as const,
    modalClassSave: 'recruit:settings:class:save' as const,
    classEdit: (id: string) => `recruit:settings:class:edit:${id}` as const,
    classRemove: (id: string) => `recruit:settings:class:remove:${id}` as const,
    modalClassUpdate: (id: string) => `recruit:settings:class:update:${id}` as const,
    isClassEdit: (id: string) => id.startsWith('recruit:settings:class:edit:'),
    isClassRemove: (id: string) => id.startsWith('recruit:settings:class:remove:'),
    isModalClassUpdate: (id: string) => id.startsWith('recruit:settings:class:update:'),

    selectPanelChannel: 'recruit:settings:select:panel' as const,
    selectFormsChannel: 'recruit:settings:select:forms' as const,

    modalForm: 'recruit:settings:form:modal' as const,
    modalAppearance: 'recruit:settings:appearance:modal' as const,
    modalDM: 'recruit:settings:dm:modal' as const,

    // Decisão
    approve: (appId: string) => `recruit:decision:approve:${appId}` as const,
    reject: (appId: string) => `recruit:decision:reject:${appId}` as const,
    isApprove: (id: string) => id.startsWith('recruit:decision:approve:'),
    isReject: (id: string) => id.startsWith('recruit:decision:reject:'),
    modalRejectReason: (appId: string) => `recruit:decision:reject:modal:${appId}` as const,
  },

  events: {
    new: 'events:new' as const,
    notify: (eventId: string) => `events:notify:${eventId}` as const,
    cancel: (eventId: string) => `events:cancel:${eventId}` as const,
    rsvp: (choice: RsvpChoice, eventId: string) => `events:rsvp:${choice}:${eventId}` as const,

    isNotify: (id: string) => id.startsWith('events:notify:'),
    isCancel: (id: string) => id.startsWith('events:cancel:'),
    isRsvp: (id: string) => id.startsWith('events:rsvp:'),
    parseNotify: (id: string) => { const p = id.split(':'); return p.length === 3 ? { eventId: p[2] } : null; },
    parseCancel: (id: string) => { const p = id.split(':'); return p.length === 3 ? { eventId: p[2] } : null; },
    parseRsvp: (id: string) => {
      const p = id.split(':'); // events:rsvp:{choice}:{id}
      if (p.length !== 4) return null;
      const choice = p[2] as RsvpChoice;
      if (choice !== 'yes' && choice !== 'maybe' && choice !== 'no') return null;
      return { choice, eventId: p[3] };
    },
  },

  activity: { publish: 'activity:publish' as const, check: 'activity:check' as const },
  admin: { clean: 'admin:clean' as const },
} as const;
