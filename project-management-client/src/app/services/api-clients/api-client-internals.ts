import { HttpHeaders } from '@angular/common/http';

/** Fluent builder for HttpClient options. */
export class HttpOptionsBuilder {

    constructor(private readonly token: string | undefined) { }

    private headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    /** Adds the Authorization header with the stored JWT. */
    withAuthorization(): this {
        if (this.token) {
            this.headers = this.headers.set('Authorization', this.token);
        }

        return this;
    }

    build(): { headers: HttpHeaders } {
        return { headers: this.headers };
    }
}
