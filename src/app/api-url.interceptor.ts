import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable()
export class ApiUrlInterceptor implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (!req.url.startsWith('/api') || !environment.apiUrl) {
            return next.handle(req);
        }

        const apiUrl = environment.apiUrl.replace(/\/$/, '');
        const apiReq = req.clone({ url: `${apiUrl}${req.url}` });
        return next.handle(apiReq);
    }
}
