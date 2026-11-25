import { HttpInterceptorFn } from '@angular/common/http';

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const token = sessionStorage.getItem('aegis_auth_token');
  if (!token || !request.url.startsWith('/api/')) {
    return next(request);
  }

  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
