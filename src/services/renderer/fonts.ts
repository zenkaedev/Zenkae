// src/services/renderer/fonts.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cache de fontes carregadas
const fontCache = new Map<string, ArrayBuffer>();

/**
 * Carrega uma fonte do sistema de arquivos ou da web
 */
export async function loadFont(fontPath: string): Promise<ArrayBuffer> {
    if (fontCache.has(fontPath)) {
        return fontCache.get(fontPath)!;
    }

    let buffer: ArrayBuffer;

    if (fontPath.startsWith('http')) {
        // Carregar da web (Google Fonts, etc)
        const response = await fetch(fontPath);
        buffer = await response.arrayBuffer();
    } else {
        // Carregar do filesystem
        const absolutePath = path.resolve(__dirname, fontPath);
        const data = await fs.readFile(absolutePath);
        // Explicit cast to ArrayBuffer to fix type error
        buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    }

    fontCache.set(fontPath, buffer);
    return buffer;
}

/**
 * Carrega fontes padrão do projeto
 * Usando system fonts como fallback (mais confiável em produção)
 */
export async function loadDefaultFonts() {
    // Em produção (Squarecloud), usar fontes do sistema
    // Satori aceita array vazio e usa fallback
    console.log('[Fonts] Using system font fallback');
    return [];

    /* Google Fonts approach (unreliable in some environments)
    try {
      const inter = await fetch(
        'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff'
      );
      const interBuffer = await inter.arrayBuffer();
  
      return [
        {
          name: 'Inter',
          data: interBuffer,
          weight: 400,
          style: 'normal' as const,
        },
        {
          name: 'Inter',
          data: interBuffer,
          weight: 700,
          style: 'normal' as const,
        },
      ];
    } catch (err) {
      console.warn('Failed to load custom fonts, using system fonts');
      return [];
    }
    */
}
