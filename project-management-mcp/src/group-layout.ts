// Mirrors canvas-constants.ts from the Angular client (source of truth).
export const GROUP_TITLE_HEIGHT = 36;
export const GROUP_PADDING      = 12;
export const GROUP_CARD_GAP     = 8;
export const GROUP_ITEM_HEIGHT  = 140;  // DEFAULT_ITEM_HEIGHT
export const GROUP_ITEM_WIDTH   = 240;  // DEFAULT_ITEM_WIDTH
export const MIN_ITEM_WIDTH     = 160;
export const MIN_ITEM_HEIGHT    = 100;
export const DEFAULT_GROUP_WIDTH  = 420;
export const DEFAULT_GROUP_HEIGHT = 340;

export interface ItemLayout {
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
}

/**
 * Replicates the Angular CanvasDataService reflow logic.
 *
 * `base` is the group's starting layout (x, y, user-controlled width or height).
 * Returns the finalized group layout (with the auto-computed dimension filled in)
 * and per-member item layouts for n members.
 */
export function computeGroupLayout(
    base: ItemLayout,
    direction: string,
    wrap: boolean,
    n: number,
): { groupLayout: ItemLayout; itemLayouts: ItemLayout[] } {
    const { x, y, width, height, zIndex } = base;

    if (direction === 'vertical') {
        // height is auto-computed; width is user-controlled
        const autoHeight = n === 0
            ? DEFAULT_GROUP_HEIGHT
            : GROUP_TITLE_HEIGHT + 2 * GROUP_PADDING + n * GROUP_ITEM_HEIGHT + (n - 1) * GROUP_CARD_GAP;
        const cardWidth = Math.max(MIN_ITEM_WIDTH, width - 2 * GROUP_PADDING);
        const groupLayout = { ...base, height: autoHeight };
        const itemLayouts = Array.from({ length: n }, (_, i) => ({
            x:      x + GROUP_PADDING,
            y:      y + GROUP_TITLE_HEIGHT + GROUP_PADDING + i * (GROUP_ITEM_HEIGHT + GROUP_CARD_GAP),
            width:  cardWidth,
            height: GROUP_ITEM_HEIGHT,
            zIndex: zIndex + 1 + i,
        }));
        return { groupLayout, itemLayouts };
    }

    if (!wrap) {
        // Horizontal no-wrap: width is auto-computed; height is user-controlled
        const autoWidth = n === 0
            ? DEFAULT_GROUP_WIDTH
            : 2 * GROUP_PADDING + n * GROUP_ITEM_WIDTH + (n - 1) * GROUP_CARD_GAP;
        const cardHeight = Math.max(MIN_ITEM_HEIGHT, height - GROUP_TITLE_HEIGHT - 2 * GROUP_PADDING);
        const groupLayout = { ...base, width: autoWidth };
        const itemLayouts = Array.from({ length: n }, (_, i) => ({
            x:      x + GROUP_PADDING + i * (GROUP_ITEM_WIDTH + GROUP_CARD_GAP),
            y:      y + GROUP_TITLE_HEIGHT + GROUP_PADDING,
            width:  GROUP_ITEM_WIDTH,
            height: cardHeight,
            zIndex: zIndex + 1 + i,
        }));
        return { groupLayout, itemLayouts };
    }

    // Horizontal wrap: width is user-controlled; height is auto-computed
    const itemsPerRow = Math.max(1,
        Math.floor((width - 2 * GROUP_PADDING + GROUP_CARD_GAP) / (GROUP_ITEM_WIDTH + GROUP_CARD_GAP)));
    const numRows  = n === 0 ? 0 : Math.ceil(n / itemsPerRow);
    const autoHeight = n === 0
        ? DEFAULT_GROUP_HEIGHT
        : GROUP_TITLE_HEIGHT + 2 * GROUP_PADDING + numRows * GROUP_ITEM_HEIGHT + Math.max(0, numRows - 1) * GROUP_CARD_GAP;
    const groupLayout = { ...base, height: autoHeight };
    const itemLayouts = Array.from({ length: n }, (_, i) => {
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;
        return {
            x:      x + GROUP_PADDING + col * (GROUP_ITEM_WIDTH + GROUP_CARD_GAP),
            y:      y + GROUP_TITLE_HEIGHT + GROUP_PADDING + row * (GROUP_ITEM_HEIGHT + GROUP_CARD_GAP),
            width:  GROUP_ITEM_WIDTH,
            height: GROUP_ITEM_HEIGHT,
            zIndex: zIndex + 1 + i,
        };
    });
    return { groupLayout, itemLayouts };
}
