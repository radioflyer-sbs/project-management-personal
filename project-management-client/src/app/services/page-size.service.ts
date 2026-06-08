import { Injectable } from '@angular/core';
import { fromEvent, Observable, startWith } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

export interface PageSize {
    width: number;
    height: number;
}

/** Single source of truth for window dimensions and responsive breakpoints. */
@Injectable({ providedIn: 'root' })
export class PageSizeService {

    constructor() { }

    /** Emits the current window size on every resize, and immediately on subscribe. */
    pageResized$: Observable<PageSize> = fromEvent(window, 'resize').pipe(
        startWith(undefined),
        map(() => ({ width: window.innerWidth, height: window.innerHeight })),
        shareReplay(1)
    );

    /** True when the viewport width is below 1024px. */
    isSkinnyPage$: Observable<boolean> = this.pageResized$.pipe(
        map(size => size.width < 1024),
        shareReplay(1)
    );
}
