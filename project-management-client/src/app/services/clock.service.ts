import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

/**
 * Shared, app-wide "current time" tick. A single timer is multicast to all subscribers
 * (via shareReplay), so every due-date countdown updates together without each card
 * spinning up its own interval. Emits immediately, then every 30 seconds — enough for a
 * minute-granularity (HH:MM) display.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
    readonly now$: Observable<Date> = timer(0, 30_000).pipe(
        map(() => new Date()),
        shareReplay({ bufferSize: 1, refCount: false }),
    );
}
