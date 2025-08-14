// src/ui/common/tokens.ts
// Paleta e tokens visuais do Zenkae (centralizado)

export const COLORS = {
  // identidade
  primary: 0x3d348b,   // roxo (destaques)
  neutral: 0x191716,   // preto/cinza base
  accent:  0xe6af2e,   // amarelo (toques pontuais/futuro)

  // feedback (padrões Discord + nossa diretriz)
  success: 0x57f287,   // verde
  danger:  0xed4245,   // vermelho

  // texto
  textLight: '#E0E2DB', // branco quente para fundos escuros
} as const;

export const BRAND = {
  name: 'Zenkae',
} as const;

export const SPACING = { xs: 2, sm: 4, md: 8, lg: 16 } as const;
