type Draft = {
  nick?: string;
  classId?: string;
};

const mem = new Map<string, Draft>(); // key: `${guildId}:${userId}`

function key(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export const recruitDrafts = {
  async getUserDraft(guildId: string, userId: string): Promise<Draft> {
    return mem.get(key(guildId, userId)) ?? {};
  },

  async setUserDraft(guildId: string, userId: string, patch: Partial<Draft>): Promise<void> {
    const k = key(guildId, userId);
    const cur = mem.get(k) ?? {};
    mem.set(k, { ...cur, ...patch });
  },

    async clearUserDraft(guildId: string, userId: string): Promise<void> {
      mem.delete(key(guildId, userId));
    }
  };