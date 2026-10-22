import * as Sentry from "@sentry/svelte";
import type { HandleClientError } from "@sveltejs/kit";

// El DSN del front no es un secreto: solo sirve para mandar datos, no para leerlos.
Sentry.init({
    dsn: "https://d55ebaab50c3aa85850e74c0e7de473c@o4512297120628736.ingest.us.sentry.io/4512297122791424",
    environment: window.location.hostname, // QA, PROD o localhost
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
});

export const handleError: HandleClientError = ({ error }) => {
    Sentry.captureException(error);
};
