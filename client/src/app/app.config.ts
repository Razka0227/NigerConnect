import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    // Enable the service worker only when the worker script actually exists
    // (helps avoid 404 during local static serving when the production build
    // wasn't generated). We perform a synchronous HEAD check — small & safe
    // for bootstrap-time detection.
    provideServiceWorker('ngsw-worker.js', {
      enabled: ((): boolean => {
        try {
          if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') return false;
          const req = new XMLHttpRequest();
          req.open('HEAD', '/ngsw-worker.js', false);
          req.send(null);
          return req.status === 200;
        } catch (e) {
          return false;
        }
      })(),
      registrationStrategy: 'registerWhenStable:3000',
    }),
  ],
};
