import type { ColorSlotId, HexColor, HumationManifest, PartOption, PartOptionId, SelectionSlotId, UiGroupId } from './types.js';
export type CreatePartPreviewOptions = {
    colors?: Record<ColorSlotId, HexColor>;
    background?: HexColor | 'transparent';
};
export declare function createPartPreview(manifest: HumationManifest, part: PartOption | PartOptionId, options?: CreatePartPreviewOptions): {
    toString(): string;
    toDataUri(): string;
};
export declare function getPartsForSlot(manifest: HumationManifest, slotId: SelectionSlotId): PartOption[];
export declare function getPartsForUiGroup(manifest: HumationManifest, groupId: UiGroupId): PartOption[];
//# sourceMappingURL=ui-helpers.d.ts.map