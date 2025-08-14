import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const ClassOptionSchema = z.object({
  label: z.string().min(1).max(32),
  value: z.string().min(1).max(32),
});

export const QuestionSchema = z.object({
  id: z.string().min(1).max(32),
  label: z.string().min(1).max(100),
  type: z.enum(["short", "paragraph", "select"]), // "select" reservado p/ futuro
  required: z.boolean().default(true),
  options: z.array(z.string().min(1).max(100)).optional(), // só para "select"
});

export const FormConfigSchema = z.object({
  classOptions: z.array(ClassOptionSchema).min(1),
  questions: z.array(QuestionSchema).max(4).optional().default([]), // máx 4 além do Nick
});

export type FormConfig = z.infer<typeof FormConfigSchema>;

export const DEFAULT_FORM_CONFIG: FormConfig = {
  classOptions: [
    { label: "Guerreiro", value: "warrior" },
    { label: "Mago", value: "mage" },
    { label: "Arqueiro", value: "archer" },
    { label: "Cavaleiro", value: "knight" },
  ],
  questions: [
    { id: "idade", label: "Idade", type: "short", required: true },
    { id: "experiencia", label: "Experiência em MMOs", type: "paragraph", required: true },
    { id: "disponibilidade", label: "Dias/horários que costuma jogar", type: "paragraph", required: false },
  ],
};

function safeParseJSON<T>(str: string | null | undefined, fallback: T, schema: z.ZodType<T>): T {
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str) as unknown;
    const res = schema.safeParse(parsed);
    return res.success ? res.data : fallback;
  } catch {
    return fallback;
  }
}

export class GuildConfigRepo {
  constructor(private prisma: PrismaClient) {}

  async get(guildId: string) {
    return this.prisma.guildConfig.findUnique({ where: { guildId } });
  }

  async ensure(guildId: string) {
    let row = await this.get(guildId);
    if (!row) {
      row = await this.prisma.guildConfig.create({ data: { guildId } });
    }
    return row;
  }

  async getFormConfig(guildId: string): Promise<FormConfig> {
    const row = await this.ensure(guildId);
    const classOptions = safeParseJSON(row.classOptions, DEFAULT_FORM_CONFIG.classOptions, z.array(ClassOptionSchema));
    const questions = safeParseJSON(row.formQuestions, DEFAULT_FORM_CONFIG.questions, z.array(QuestionSchema).max(4));
    return FormConfigSchema.parse({ classOptions, questions });
  }

  async setFormConfig(guildId: string, cfg: FormConfig) {
    const parsed = FormConfigSchema.parse(cfg);
    await this.ensure(guildId);
    await this.prisma.guildConfig.update({
      where: { guildId },
      data: {
        classOptions: JSON.stringify(parsed.classOptions),
        formQuestions: JSON.stringify(parsed.questions ?? []),
      },
    });
  }

  async resetFormConfig(guildId: string) {
    await this.setFormConfig(guildId, DEFAULT_FORM_CONFIG);
  }
}