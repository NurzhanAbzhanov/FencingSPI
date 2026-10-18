declare global {
    interface Window { NCAA_FENCING_ASSET_BASE?: string }
}

export function publicAsset(path: string): string {
    const base = window.NCAA_FENCING_ASSET_BASE;
    return base && path.startsWith("/") && !path.startsWith("//")
        ? `${base.replace(/\/$/, "")}${path}`
        : path;
}
