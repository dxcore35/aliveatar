import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useMemo } from 'react';
import { createAvatar } from '@humation/core';
export const Avatar = forwardRef(function Avatar({ assets, seed, selections, colors, background, crop, size, title, style, ...rest }, ref) {
    const selectionsKey = JSON.stringify(selections !== null && selections !== void 0 ? selections : null);
    const data = useMemo(() => createAvatar(assets, { seed, selections, background, crop }).toRenderData(), 
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selections is keyed by value
    [assets, seed, selectionsKey, background, crop]);
    const colorVariables = {};
    for (const [slot, value] of Object.entries(colors !== null && colors !== void 0 ? colors : {})) {
        colorVariables[`--hm-${slot}`] =
            normalizeCssColor(value);
    }
    const { viewBox } = data;
    const width = size !== null && size !== void 0 ? size : viewBox.width;
    const height = typeof size === 'number'
        ? (size * viewBox.height) / viewBox.width
        : typeof size === 'string'
            ? 'auto'
            : viewBox.height;
    return (_jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`, width: width, height: height, role: title ? 'img' : undefined, "aria-hidden": title ? undefined : true, ref: ref, style: { ...colorVariables, ...style }, ...rest, children: [title ? _jsx("title", { children: title }) : null, data.background !== 'transparent' ? (_jsx("rect", { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height, fill: `#${data.background}` })) : null, _jsx("g", { dangerouslySetInnerHTML: { __html: data.content } })] }));
});
function normalizeCssColor(value) {
    const trimmed = value.trim();
    return /^[0-9a-fA-F]{6}$/.test(trimmed) ? `#${trimmed}` : trimmed;
}
//# sourceMappingURL=index.js.map