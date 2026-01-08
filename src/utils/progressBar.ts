export function createProgressBar(current: number, total: number, size: number = 10): string {
    const percentage = Math.min(Math.max(current / total, 0), 1);
    const progress = Math.round(size * percentage);
    const emptyProgress = size - progress;

    // Caracteres para a barra
    const progressText = '▰'.repeat(progress);
    const emptyProgressText = '▱'.repeat(emptyProgress);

    return `${progressText}${emptyProgressText}`;
}
