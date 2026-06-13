import { Injectable, inject, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { ViewportService } from './viewport.service';
import { MIN_ITEM_WIDTH, MIN_ITEM_HEIGHT } from '../../model/shared-models/canvas-constants';
import { Layout } from '../../model/shared-models/layout.model';

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export type DragItemType = 'task' | 'note' | 'group';

export interface DragMoveEvent {
    id: string;
    isTask: boolean;
    itemType: DragItemType;
    fromGroupDrag: boolean;
    layout: Layout;
    /** True once the pointer has moved ≥ MIN_DRAG_PX screen pixels from the mousedown origin. */
    hasMoved: boolean;
}

const MIN_DRAG_PX = 25;

export interface DragResizeEvent {
    id: string;
    isTask: boolean;
    itemType: DragItemType;
    layout: Layout;
}

/** Handles all pointer interactions for the canvas: pan, zoom, move, resize. */
@Injectable()
export class CanvasInteractionService {

    constructor() { }

    private readonly viewport = inject(ViewportService);
    private readonly zone     = inject(NgZone);

    /** Fires on every pointermove during a drag — handled by cards directly, outside Angular zone. */
    readonly moveDragging$   = new Subject<DragMoveEvent>();
    /** Fires once on pointerup — handled by host to persist the final layout. */
    readonly moveEnded$      = new Subject<DragMoveEvent>();
    /** Fires on every pointermove during a resize — handled by cards directly, outside Angular zone. */
    readonly resizeDragging$ = new Subject<DragResizeEvent>();
    /** Fires once on pointerup — handled by host to persist the final layout. */
    readonly resizeEnded$    = new Subject<DragResizeEvent>();

    // --- Pan (middle mouse button drag) ---
    private isPanning = false;
    private panStart  = { x: 0, y: 0 };

    onCanvasMousedown(e: MouseEvent): void {
        if (e.button !== 1) { return; }
        e.preventDefault();
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };

        const onMove = (me: MouseEvent) => {
            if (!this.isPanning) { return; }
            this.viewport.pan(me.clientX - this.panStart.x, me.clientY - this.panStart.y);
            this.panStart = { x: me.clientX, y: me.clientY };
        };
        const onUp = () => {
            this.isPanning = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    onWheel(e: WheelEvent, canvasRect: DOMRect): void {
        e.preventDefault();
        const screenX = e.clientX - canvasRect.left;
        const screenY = e.clientY - canvasRect.top;
        this.viewport.zoomAt(screenX, screenY, -e.deltaY);
    }

    // --- Move (left button drag on card body) ---
    startMove(
        e: PointerEvent,
        id: string,
        isTask: boolean,
        currentLayout: Layout,
    ): void {
        e.stopPropagation();
        const { zoom } = this.viewport.current;
        let layout   = { ...currentLayout };
        let lastX    = e.clientX;
        let lastY    = e.clientY;
        const startX = e.clientX;
        const startY = e.clientY;
        let hasMoved = false;
        const itemType: DragItemType = isTask ? 'task' : 'note';

        const onMove = (me: PointerEvent) => {
            if (!hasMoved) {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                if (Math.sqrt(dx * dx + dy * dy) >= MIN_DRAG_PX) { hasMoved = true; }
            }
            const dx = (me.clientX - lastX) / zoom;
            const dy = (me.clientY - lastY) / zoom;
            layout = { ...layout, x: layout.x + dx, y: layout.y + dy };
            lastX = me.clientX;
            lastY = me.clientY;
            this.moveDragging$.next({ id, isTask, itemType, fromGroupDrag: false, layout: { ...layout }, hasMoved });
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            this.moveEnded$.next({ id, isTask, itemType, fromGroupDrag: false, layout, hasMoved });
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }

    // --- Move group (drags the group and all contained items together) ---
    startMoveGroup(
        e: PointerEvent,
        id: string,
        currentLayout: Layout,
        containedItems: Array<{ id: string; isTask: boolean; layout: Layout }>,
    ): void {
        e.stopPropagation();
        const { zoom } = this.viewport.current;
        let layout   = { ...currentLayout };
        let items    = containedItems.map(i => ({ ...i, layout: { ...i.layout } }));
        let lastX    = e.clientX;
        let lastY    = e.clientY;
        const startX = e.clientX;
        const startY = e.clientY;
        let hasMoved = false;

        const onMove = (me: PointerEvent) => {
            if (!hasMoved) {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                if (Math.sqrt(dx * dx + dy * dy) >= MIN_DRAG_PX) { hasMoved = true; }
            }
            const dx = (me.clientX - lastX) / zoom;
            const dy = (me.clientY - lastY) / zoom;
            layout = { ...layout, x: layout.x + dx, y: layout.y + dy };
            items = items.map(item => ({
                ...item,
                layout: { ...item.layout, x: item.layout.x + dx, y: item.layout.y + dy },
            }));
            lastX = me.clientX;
            lastY = me.clientY;
            this.moveDragging$.next({ id, isTask: false, itemType: 'group', fromGroupDrag: false, layout: { ...layout }, hasMoved });
            items.forEach(item =>
                this.moveDragging$.next({
                    id: item.id, isTask: item.isTask,
                    itemType: item.isTask ? 'task' : 'note',
                    fromGroupDrag: true,
                    layout: { ...item.layout },
                    hasMoved,
                })
            );
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            this.moveEnded$.next({ id, isTask: false, itemType: 'group', fromGroupDrag: false, layout, hasMoved });
            items.forEach(item =>
                this.moveEnded$.next({
                    id: item.id, isTask: item.isTask,
                    itemType: item.isTask ? 'task' : 'note',
                    fromGroupDrag: true,
                    layout: item.layout,
                    hasMoved,
                })
            );
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }

    // --- Move multiple selected items together ---
    startMoveMany(
        e: PointerEvent,
        independentItems: Array<{ id: string; isTask: boolean; layout: Layout }>,
        movingGroups: Array<{ id: string; layout: Layout; containedItems: Array<{ id: string; isTask: boolean; layout: Layout }> }>,
    ): void {
        e.stopPropagation();
        const { zoom } = this.viewport.current;

        let items  = independentItems.map(i => ({ ...i, layout: { ...i.layout } }));
        let groups = movingGroups.map(g => ({
            ...g,
            layout:         { ...g.layout },
            containedItems: g.containedItems.map(ci => ({ ...ci, layout: { ...ci.layout } })),
        }));

        let lastX    = e.clientX;
        let lastY    = e.clientY;
        const startX = e.clientX;
        const startY = e.clientY;
        let hasMoved = false;

        const onMove = (me: PointerEvent) => {
            if (!hasMoved) {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                if (Math.sqrt(dx * dx + dy * dy) >= MIN_DRAG_PX) { hasMoved = true; }
            }
            const dx = (me.clientX - lastX) / zoom;
            const dy = (me.clientY - lastY) / zoom;
            lastX = me.clientX;
            lastY = me.clientY;

            items = items.map(i => ({
                ...i, layout: { ...i.layout, x: i.layout.x + dx, y: i.layout.y + dy },
            }));
            groups = groups.map(g => ({
                ...g,
                layout: { ...g.layout, x: g.layout.x + dx, y: g.layout.y + dy },
                containedItems: g.containedItems.map(ci => ({
                    ...ci, layout: { ...ci.layout, x: ci.layout.x + dx, y: ci.layout.y + dy },
                })),
            }));

            // Independent items use fromGroupDrag: true so moveEnded$ skips group-enter/exit logic
            items.forEach(i => this.moveDragging$.next({
                id: i.id, isTask: i.isTask, itemType: i.isTask ? 'task' : 'note',
                fromGroupDrag: true, layout: { ...i.layout }, hasMoved,
            }));
            groups.forEach(g => {
                this.moveDragging$.next({ id: g.id, isTask: false, itemType: 'group', fromGroupDrag: false, layout: { ...g.layout }, hasMoved });
                g.containedItems.forEach(ci => this.moveDragging$.next({
                    id: ci.id, isTask: ci.isTask, itemType: ci.isTask ? 'task' : 'note',
                    fromGroupDrag: true, layout: { ...ci.layout }, hasMoved,
                }));
            });
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup',  onUp);

            items.forEach(i => this.moveEnded$.next({
                id: i.id, isTask: i.isTask, itemType: i.isTask ? 'task' : 'note',
                fromGroupDrag: true, layout: i.layout, hasMoved,
            }));
            groups.forEach(g => {
                this.moveEnded$.next({ id: g.id, isTask: false, itemType: 'group', fromGroupDrag: false, layout: g.layout, hasMoved });
                g.containedItems.forEach(ci => this.moveEnded$.next({
                    id: ci.id, isTask: ci.isTask, itemType: ci.isTask ? 'task' : 'note',
                    fromGroupDrag: true, layout: ci.layout, hasMoved,
                }));
            });
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup',  onUp);
    }

    // --- Resize ---
    startResize(
        e: PointerEvent,
        id: string,
        isTask: boolean,
        handle: ResizeHandle,
        currentLayout: Layout,
    ): void {
        e.stopPropagation();
        e.preventDefault();
        const { zoom } = this.viewport.current;
        let layout = { ...currentLayout };
        let lastX = e.clientX;
        let lastY = e.clientY;
        const itemType: DragItemType = isTask ? 'task' : 'note';

        const onMove = (me: PointerEvent) => {
            const dx = (me.clientX - lastX) / zoom;
            const dy = (me.clientY - lastY) / zoom;
            lastX = me.clientX;
            lastY = me.clientY;
            layout = applyResize(layout, handle, dx, dy);
            this.resizeDragging$.next({ id, isTask, itemType, layout: { ...layout } });
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            this.resizeEnded$.next({ id, isTask, itemType, layout });
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }

    // --- Resize group ---
    startResizeGroup(
        e: PointerEvent,
        id: string,
        handle: ResizeHandle,
        currentLayout: Layout,
    ): void {
        e.stopPropagation();
        e.preventDefault();
        const { zoom } = this.viewport.current;
        let layout = { ...currentLayout };
        let lastX = e.clientX;
        let lastY = e.clientY;

        const onMove = (me: PointerEvent) => {
            const dx = (me.clientX - lastX) / zoom;
            const dy = (me.clientY - lastY) / zoom;
            lastX = me.clientX;
            lastY = me.clientY;
            layout = applyResize(layout, handle, dx, dy);
            this.resizeDragging$.next({ id, isTask: false, itemType: 'group', layout: { ...layout } });
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            this.resizeEnded$.next({ id, isTask: false, itemType: 'group', layout });
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }
}

function applyResize(layout: Layout, handle: ResizeHandle, dx: number, dy: number): Layout {
    let { x, y, width, height } = layout;

    if (handle.includes('e')) { width  = Math.max(MIN_ITEM_WIDTH,  width  + dx); }
    if (handle.includes('s')) { height = Math.max(MIN_ITEM_HEIGHT, height + dy); }
    if (handle.includes('w')) {
        const newWidth = Math.max(MIN_ITEM_WIDTH, width - dx);
        x += width - newWidth;
        width = newWidth;
    }
    if (handle.includes('n')) {
        const newHeight = Math.max(MIN_ITEM_HEIGHT, height - dy);
        y += height - newHeight;
        height = newHeight;
    }

    return { ...layout, x, y, width, height };
}
