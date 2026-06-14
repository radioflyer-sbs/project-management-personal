import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {

    private socket: Socket;
    private readonly ngZone = inject(NgZone);
    private readonly dataChangedSubject = new Subject<void>();

    readonly dataChanged$: Observable<void> = this.dataChangedSubject.asObservable();

    constructor() {
        this.socket = io(environment.socketUrl, { transports: ['websocket', 'polling'] });
        // Run inside Angular's zone so subscribers trigger change detection automatically.
        this.socket.on('data-changed', () => this.ngZone.run(() => this.dataChangedSubject.next()));
    }

    ngOnDestroy(): void {
        this.socket.disconnect();
        this.dataChangedSubject.complete();
    }
}
