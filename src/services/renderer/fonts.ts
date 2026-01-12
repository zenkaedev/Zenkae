// src/services/renderer/fonts.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../../infra/logger.js';

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
 * Usando UNPKG CDN (mais confiável que Google Fonts direto)
 */
export async function loadDefaultFonts() {
    try {
        // Using Inter from @fontsource via UNPKG
        const fontUrl = 'https://unpkg.com/@fontsource/inter@5.0.16/files/inter-latin-400-normal.woff';

        logger.debug('Loading Inter font from UNPKG');
        const response = await fetch(fontUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status}`);
        }

        const fontData = await response.arrayBuffer();
        logger.info('Inter font loaded successfully');

        return [
            {
                name: 'Inter',
                data: fontData,
                weight: 400,
                style: 'normal' as const,
            },
        ];
    } catch (err) {
        logger.error({ error: err }, 'Failed to load custom font');
        // Fallback: use a minimal embedded font (Noto Sans)
        // This is a last resort - loading from CDN should work
        throw new Error('Unable to load fonts. Please check network connectivity.');
    }
}
