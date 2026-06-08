import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TokenService } from '../token.service';
import { HttpOptionsBuilder } from './api-client-internals';

/** Abstract base for all API client services. */
export abstract class ApiClientBase {

    protected readonly http = inject(HttpClient);
    protected readonly tokenService = inject(TokenService);
    protected readonly apiBaseUrl = environment.apiBaseUrl;

    protected buildOptions(): HttpOptionsBuilder {
        return new HttpOptionsBuilder(this.tokenService.getToken());
    }
}
