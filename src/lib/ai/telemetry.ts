/**
 * DukaanVoice PK — Agent Telemetry (`Munshi AI` observability)
 *
 * Provides lightweight, dependency-free tracing for the shop AI agent. Every
 * agent run produces a trace made of nested spans (intent resolution, each tool
 * call, model inference, voice synthesis). This is what powers:
 *
 *   1. The in-app "Agent Trace" panel (works fully offline, no account needed).
 *   2. A Sentry span sink — when `@sentry/nextjs` is installed and a DSN is
 *      configured, the same spans are forwarded to Sentry Agent Tracing.
 *
 * The design keeps the app independent of any observability vendor: Sentry is
 * *optional* and wired in through `setSpanSink`, so the register never depends on
 * the network to function.
 */

export type SpanStatus = 'ok' | 'error';

export interface AgentSpan {
  id: string;
  traceId: string;
  name: string;
  op: string;
  startedAt: number;
  durationMs: number;
  status: SpanStatus;
  attributes: Record<string, string | number | boolean>;
  error?: string;
}

export interface AgentTrace {
  id: string;
  label: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  spans: AgentSpan[];
  status: SpanStatus;
}

/** A consumer of finished spans. One is wired to Sentry when available. */
export type SpanSink = (span: AgentSpan) => void;

let spanSink: SpanSink | null = null;

export function setSpanSink(sink: SpanSink | null): void {
  spanSink = sink;
}

// ── In-memory ring buffer so the UI can show the last N agent runs offline ────
const MAX_TRACES = 25;
const traces: AgentTrace[] = [];

export function getRecentTraces(): AgentTrace[] {
  return [...traces].reverse();
}

export function getTrace(id: string): AgentTrace | undefined {
  return traces.find(t => t.id === id);
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function startTrace(label: string): AgentTrace {
  const trace: AgentTrace = {
    id: uid(),
    label,
    startedAt: Date.now(),
    spans: [],
    status: 'ok',
  };
  traces.push(trace);
  if (traces.length > MAX_TRACES) traces.shift();
  return trace;
}

export function endTrace(trace: AgentTrace, status: SpanStatus = 'ok'): AgentTrace {
  trace.endedAt = Date.now();
  trace.durationMs = trace.endedAt - trace.startedAt;
  trace.status = status;
  return trace;
}

interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Run `fn` inside a span, recording duration + status, capturing thrown errors
 * (without swallowing them), and forwarding the span to the sink if present.
 */
export async function withSpan<T>(
  trace: AgentTrace,
  name: string,
  op: string,
  fn: () => Promise<T> | T,
  options: SpanOptions = {},
): Promise<T> {
  const startedAt = Date.now();
  const attributes = options.attributes ?? {};
  let status: SpanStatus = 'ok';
  let errorMessage: string | undefined;

  try {
    const result = await fn();
    return result;
  } catch (err) {
    status = 'error';
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const span: AgentSpan = {
      id: uid(),
      traceId: trace.id,
      name,
      op,
      startedAt,
      durationMs: Date.now() - startedAt,
      status,
      attributes,
      error: errorMessage,
    };
    trace.spans.push(span);
    if (status === 'error') trace.status = 'error';
    try {
      spanSink?.(span);
    } catch {
      // Never let observability break the agent.
    }
  }
}

/** Synchronous variant for fast, non-async steps (e.g. intent routing). */
export function addSpan(
  trace: AgentTrace,
  name: string,
  op: string,
  durationMs: number,
  attributes: Record<string, string | number | boolean> = {},
): void {
  const span: AgentSpan = {
    id: uid(),
    traceId: trace.id,
    name,
    op,
    startedAt: Date.now() - durationMs,
    durationMs,
    status: 'ok',
    attributes,
  };
  trace.spans.push(span);
  try {
    spanSink?.(span);
  } catch {
    // ignore
  }
}
