import type { SVGProps } from 'react';
import type { HumationManifest } from '@humation/core';
export type AvatarProps = {
    /** The asset set to draw with, e.g. `humation1` from `@humation/assets-humation-1`. */
    assets: HumationManifest;
    /** Deterministic part picks per slot — same seed, same avatar. */
    seed?: string;
    /**
     * Part selections by name, alias, or canonical ID,
     * e.g. `{ head: 'braids', item: 'calico-cat' }`.
     */
    selections?: Record<string, string>;
    /**
     * Color slot values (`{ hair: '#4A3728' }`, `#` optional). Applied as CSS
     * custom properties on the <svg> element, so changing colors never
     * re-renders the avatar content; unspecified slots keep the defaults baked
     * into the assets and stay themeable from outer CSS.
     */
    colors?: Record<string, string>;
    /** Background fill (hex or 'transparent'). Defaults to the manifest default. */
    background?: string;
    /** Crop id. Defaults to the manifest default ('avatar'). */
    crop?: string;
    /** Rendered size. Numbers keep the crop's aspect ratio. */
    size?: number | string;
    /** Accessible title. Without it the avatar is treated as decorative. */
    title?: string;
} & Omit<SVGProps<SVGSVGElement>, 'children'>;
export declare const Avatar: import("react").ForwardRefExoticComponent<Omit<AvatarProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
//# sourceMappingURL=index.d.ts.map