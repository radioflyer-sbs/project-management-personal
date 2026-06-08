import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, debounceTime } from 'rxjs';
import { CanvasViewState } from '../../model/shared-models/canvas-view-state.model';
import { Layout } from '../../model/shared-models/layout.model';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '../../model/shared-models/canvas-constants';

export interface ViewState {
    panX: number;
    panY: number;
    zoom: number;
}

@Injectable()
export class ViewportService {

    constructor() { }

    private readonly state$ = new BehaviorSubject<ViewState>({ panX: 0, panY: 0, zoom: 1 });
    private readonly persistTrigger$ = new Subject<ViewState>();

    readonly viewState$: Observable<ViewState> = this.state$.asObservable();
    readonly persistNeeded$: Observable<ViewState> = this.persistTrigger$.pipe(debounceTime(1000));

    get current(): ViewState { return this.state$.getValue(); }

    /** Converts screen-space coordinates to canvas-space. */
    screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
        const { panX, panY, zoom } = this.current;
        return {
            x: (screenX - panX) / zoom,
            y: (screenY - panY) / zoom,
        };
    }

    /** Converts canvas-space coordinates to screen-space. */
    canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
        const { panX, panY, zoom } = this.current;
        return {
            x: canvasX * zoom + panX,
            y: canvasY * zoom + panY,
        };
    }

    get cssTransform(): string {
        const { panX, panY, zoom } = this.current;
        return `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }

    restore(viewState: CanvasViewState | undefined): void {
        if (viewState) {
            this.state$.next({ panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom });
        } else {
            this.state$.next({ panX: 0, panY: 0, zoom: 1 });
        }
    }

    pan(dx: number, dy: number): void {
        const s = this.current;
        const next = { ...s, panX: s.panX + dx, panY: s.panY + dy };
        this.state$.next(next);
        this.persistTrigger$.next(next);
    }

    zoomToFit(layouts: Layout[], viewportWidth: number, viewportHeight: number): void {
        const PADDING = 48;

        if (layouts.length === 0) {
            const next = { panX: 0, panY: 0, zoom: 1 };
            this.state$.next(next);
            this.persistTrigger$.next(next);
            return;
        }

        const minX = Math.min(...layouts.map(l => l.x));
        const minY = Math.min(...layouts.map(l => l.y));
        const maxX = Math.max(...layouts.map(l => l.x + l.width));
        const maxY = Math.max(...layouts.map(l => l.y + l.height));

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        const zoom = Math.min(
            ZOOM_MAX,
            Math.max(ZOOM_MIN, Math.min(
                (viewportWidth  - 2 * PADDING) / contentW,
                (viewportHeight - 2 * PADDING) / contentH,
            ))
        );

        const panX = (viewportWidth  - contentW * zoom) / 2 - minX * zoom;
        const panY = (viewportHeight - contentH * zoom) / 2 - minY * zoom;

        const next = { panX, panY, zoom };
        this.state$.next(next);
        this.persistTrigger$.next(next);
    }

    zoomAt(screenX: number, screenY: number, direction: number): void {
        const s = this.current;
        const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s.zoom * factor));

        // Keep the canvas point under the pointer stationary
        const panX = screenX - (screenX - s.panX) * (newZoom / s.zoom);
        const panY = screenY - (screenY - s.panY) * (newZoom / s.zoom);

        const next = { panX, panY, zoom: newZoom };
        this.state$.next(next);
        this.persistTrigger$.next(next);
    }
}
