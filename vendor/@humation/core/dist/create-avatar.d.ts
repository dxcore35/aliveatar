import type { AvatarJson, AvatarRenderData, CreateAvatarOptions, HumationManifest } from './types.js';
export declare function createAvatar(manifest: HumationManifest, options?: CreateAvatarOptions): {
    toString(): string;
    toDataUri(): string;
    toJSON(): AvatarJson;
    /**
     * Structured render output for framework wrappers that build the root
     * <svg> element themselves (React, web components). `content` is the
     * composed fragment markup without the root element, background rect,
     * or inline color style — colors stay as `var(--hm-*, fallback)`
     * references, so wrappers can drive them via CSS custom properties
     * without re-rendering the content.
     */
    toRenderData(): AvatarRenderData;
};
export declare function resolvePartId(input: string, manifest: HumationManifest, slotId?: string): string;
//# sourceMappingURL=create-avatar.d.ts.map