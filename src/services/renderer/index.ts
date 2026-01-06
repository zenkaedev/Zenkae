// src/services/renderer/index.ts
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadDefaultFonts } from './fonts.js';
import type { ReactElement } from 'react';

/**
 * Singleton Renderer Service
 * Converte JSX → SVG (Satori) → PNG (Resvg)
 */
class RendererService {
    private fonts: any[] | null = null;

    /**
     * Inicializa o serviço carregando as fontes
     */
    async initialize() {
        if (this.fonts) return;
        this.fonts = await loadDefaultFonts();
    }

    /**
     * Renderiza um componente React para PNG
     * @param element - Componente JSX (ex: <UserProfile />)
     * @param width - Largura da imagem
     * @param height - Altura da imagem
     * @returns Buffer PNG
     */
    async renderToPNG(
        element: ReactElement,
        options: { width: number; height: number }
    ): Promise<Buffer> {
        await this.initialize();

        // 1. JSX → SVG (Satori)
        const svg = await satori(element, {
            width: options.width,
            height: options.height,
            fonts: this.fonts || [],
        });

        // 2. SVG → PNG (Resvg)
        const resvg = new Resvg(svg, {
            fitTo: {
                mode: 'width',
                value: options.width,
            },
        });

        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();

        return Buffer.from(pngBuffer);
    }
}

// Singleton instance
export const renderer = new RendererService();
