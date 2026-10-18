/**
 * Next.js instrumentation hook.
 *
 * When `SENTRY_DSN` is configured, this initialises Sentry and forwards every
 * Munshi-AI agent span (see `src/lib/ai/telemetry.ts`) to **Sentry Agent
 * Tracing** as a real span with start/end timestamps and attributes.
 *
 * Two deliberate choices keep this safe:
 *  - Sentry is loaded through a runtime `import()`, so the app compiles and runs
 *    even when `@sentry/nextjs` is not installed (e.g. an offline laptop).
 *  - The module is accessed through a minimal cast interface, so a Sentry API
 *    change can never break the build or the register.
 *
 * If Sentry is unavailable, nothing happens — the agent still records traces in
 * the in-app "Agent Trace" panel, so observability works fully offline.
 */

interface SentryLike {
  init: (options: Record<string, unknown>) => void;
  startInactiveSpan: (options: Record<string, unknown>) => { end: (timestamp?: number) => void };
}

// Indirect import so the bundler does not need to resolve '@sentry/nextjs' at
// build time; it is resolved from node_modules at runtime if present.
const runtimeImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<Record<string, unknown>>;

export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const Sentry = (await runtimeImport('@sentry/nextjs')) as unknown as SentryLike;
    if (typeof Sentry.init !== 'function') return;

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      release: process.env.SENTRY_RELEASE,
      tracesSampleRate: 1.0,
    });

    const { setSpanSink } = await import('@/lib/ai/telemetry');

    setSpanSink(span => {
      try {
        const startSeconds = span.startedAt / 1000;
        const sentrySpan = Sentry.startInactiveSpan({
          name: `munshi.${span.name}`,
          op: `tool.${span.op}`,
          startTime: startSeconds,
          attributes: {
            'munshi.tool': span.name,
            'munshi.status': span.status,
            'munshi.trace_id': span.traceId,
            ...span.attributes,
          },
        });
        sentrySpan.end(startSeconds + span.durationMs / 1000);
      } catch {
        // Observability must never break the agent.
      }
    });
  } catch {
    // @sentry/nextjs not installed or failed to init — in-app traces still work.
  }
}
