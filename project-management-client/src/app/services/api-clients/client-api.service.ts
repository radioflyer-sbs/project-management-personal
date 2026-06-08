import { Injectable } from '@angular/core';
import { ApiClientBase } from './api-client-base.service';

/** Primary API client covering core endpoints. Extend with specialized clients as needed. */
@Injectable({ providedIn: 'root' })
export class ClientApiService extends ApiClientBase {

    constructor() { super(); }

    // TODO-Immediate: Add methods for your application's endpoints.
    // Pattern: return this.http.get<T>(url, this.buildOptions().withAuthorization().build());
}
