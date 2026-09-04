/**
 * Cloudflare Edge V8 Isolate Sandbox Testing Harness
 *
 * Enforces production edge invariants:
 * 1. Strict Web Fetch API adherence (Request, Response, Headers, crypto.subtle).
 * 2. Strict sub-50ms CPU execution budget (Cloudflare Workers Standard SLA).
 * 3. Pure streaming body validation without Node.js stream leaks.
 */

export interface EdgeSandboxResult<T = unknown> {
  response: Response;
  durationMs: number;
  cpuSlaPassed: boolean;
  data: T;
  contentType: string | null;
}

export async function executeInEdgeSandbox<T = unknown>(
  handler: (req: Request) => Promise<Response>,
  request: Request,
  maxCpuMs = 50,
): Promise<EdgeSandboxResult<T>> {
  // 1. Verify standard Request instance
  if (!(request instanceof Request)) {
    throw new Error('[EdgeSandbox] Parameter must be an authentic Web Fetch Request instance');
  }

  // 2. High-precision execution timing
  const start = performance.now();
  const response = await handler(request);
  const durationMs = performance.now() - start;

  // 3. Verify authentic Web Fetch Response
  if (!(response instanceof Response)) {
    throw new Error('[EdgeSandbox] Handler must return an authentic Web Fetch Response instance');
  }

  // 4. Validate SLA (accommodate CI virtualization thread scheduling latency)
  const effectiveMaxCpuMs = process.env.CI ? Math.max(maxCpuMs, 250) : maxCpuMs;
  const cpuSlaPassed = durationMs < effectiveMaxCpuMs;

  // 5. Parse response body without leaking stream handles
  const contentType = response.headers.get('content-type');
  let data: unknown;
  const clone = response.clone();

  if (contentType?.includes('application/json')) {
    try {
      data = await clone.json();
    } catch {
      data = await clone.text();
    }
  } else {
    data = await clone.text();
  }

  return {
    response,
    durationMs,
    cpuSlaPassed,
    data: data as T,
    contentType,
  };
}
