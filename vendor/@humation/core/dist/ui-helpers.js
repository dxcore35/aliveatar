export function createPartPreview(manifest, part, options = {}) {
    var _a, _b, _c;
    const resolved = typeof part === 'string'
        ? manifest.parts.find((p) => p.id === part)
        : part;
    if (!resolved)
        throw new Error(`Unknown part: ${part}`);
    const colors = Object.assign(Object.assign({}, manifest.defaults.colors), Object.fromEntries(Object.entries((_a = options.colors) !== null && _a !== void 0 ? _a : {}).map(([k, v]) => [k, normalizeHex(v)])));
    const cssVariables = Object.entries(colors)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, color]) => `--hm-${key}:#${color}`)
        .join(';');
    const fragments = resolved.layers
        .map((fragment) => {
        const layerSlot = manifest.layerSlots.find((ls) => ls.id === fragment.layerSlot);
        if (!layerSlot || !fragment.svg)
            return '';
        const content = fragment.svg
            .replace(/<svg[^>]*>/, '')
            .replace(/<\/svg>\s*$/, '');
        const transform = fragment.transform
            ? `translate(${formatNumber(layerSlot.offset.x)}, ${formatNumber(layerSlot.offset.y)}) ${fragment.transform}`
            : `translate(${formatNumber(layerSlot.offset.x)}, ${formatNumber(layerSlot.offset.y)})`;
        return `<g transform="${escapeAttr(transform)}">${content}</g>`;
    })
        .join('');
    const layerSlot = manifest.layerSlots.find((ls) => { var _a; return ls.id === ((_a = resolved.layers[0]) === null || _a === void 0 ? void 0 : _a.layerSlot); });
    const offset = (_b = layerSlot === null || layerSlot === void 0 ? void 0 : layerSlot.offset) !== null && _b !== void 0 ? _b : { x: 0, y: 0 };
    const size = (_c = layerSlot === null || layerSlot === void 0 ? void 0 : layerSlot.size) !== null && _c !== void 0 ? _c : { width: 80, height: 80 };
    const bg = options.background === undefined
        ? 'transparent'
        : options.background;
    const bgRect = bg === 'transparent'
        ? ''
        : `<rect x="${formatNumber(offset.x)}" y="${formatNumber(offset.y)}" width="${formatNumber(size.width)}" height="${formatNumber(size.height)}" fill="#${normalizeHex(bg)}" />`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(size.width)}" height="${formatNumber(size.height)}" viewBox="${formatNumber(offset.x)} ${formatNumber(offset.y)} ${formatNumber(size.width)} ${formatNumber(size.height)}" style="${escapeAttr(cssVariables)}">${bgRect}${fragments}</svg>`;
    return {
        toString() {
            return svg;
        },
        toDataUri() {
            return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        },
    };
}
export function getPartsForSlot(manifest, slotId) {
    return manifest.parts
        .filter((part) => part.selectionSlot === slotId && !part.deprecated)
        .sort((a, b) => {
        var _a, _b, _c, _d;
        const aId = (_b = (_a = a.source) === null || _a === void 0 ? void 0 : _a.partId) !== null && _b !== void 0 ? _b : a.id;
        const bId = (_d = (_c = b.source) === null || _c === void 0 ? void 0 : _c.partId) !== null && _d !== void 0 ? _d : b.id;
        return aId.localeCompare(bId);
    });
}
export function getPartsForUiGroup(manifest, groupId) {
    return manifest.parts
        .filter((part) => part.uiGroups.includes(groupId) && !part.deprecated)
        .sort((a, b) => {
        var _a, _b, _c, _d;
        const aId = (_b = (_a = a.source) === null || _a === void 0 ? void 0 : _a.partId) !== null && _b !== void 0 ? _b : a.id;
        const bId = (_d = (_c = b.source) === null || _c === void 0 ? void 0 : _c.partId) !== null && _d !== void 0 ? _d : b.id;
        return aId.localeCompare(bId);
    });
}
function normalizeHex(color) {
    return color.replace(/^#/, '').toUpperCase();
}
function formatNumber(value) {
    return Number.isInteger(value)
        ? String(value)
        : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}
function escapeAttr(value) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
//# sourceMappingURL=ui-helpers.js.map