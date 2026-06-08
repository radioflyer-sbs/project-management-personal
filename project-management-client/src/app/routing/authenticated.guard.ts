import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { TokenService } from '../services/token.service';

/** Route guard — redirects to /login if no JWT is present. */
export const authenticatedGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
    const tokenService = inject(TokenService);
    const router = inject(Router);

    if (tokenService.getToken()) {
        return of(true);
    }

    return of(router.createUrlTree(['/login']));
};
