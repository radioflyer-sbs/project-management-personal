import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientBase } from './api-client-base.service';

export interface AppStateEntry<T = unknown> {
    key: string;
    value: T;
    updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AppStateApiClient extends ApiClientBase {

    constructor() { super(); }

    get<T = unknown>(key: string): Observable<AppStateEntry<T>> {
        return this.http.get<AppStateEntry<T>>(
            `${this.apiBaseUrl}/app-state/${key}`,
            this.buildOptions().build(),
        );
    }

    set<T = unknown>(key: string, value: T): Observable<AppStateEntry<T>> {
        return this.http.put<AppStateEntry<T>>(
            `${this.apiBaseUrl}/app-state/${key}`,
            { value },
            this.buildOptions().build(),
        );
    }
}
