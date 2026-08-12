import type { HumationManifest } from './types.js';
export type ManifestValidationIssue = {
    path: string;
    message: string;
};
export declare function validateManifest(manifest: HumationManifest): ManifestValidationIssue[];
//# sourceMappingURL=validate-manifest.d.ts.map