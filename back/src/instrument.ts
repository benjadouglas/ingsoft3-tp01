import * as Sentry from "@sentry/elysia";

// Sin SENTRY_DSN (local, tests, QA) Sentry queda apagado. Solo PROD lo tiene.
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
});
