export const config = { runtime: 'nodejs' };

const PROCESS_START_TIME = Date.now();

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const uptimeSec = Math.floor((Date.now() - PROCESS_START_TIME) / 1000);

  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime_sec: uptimeSec,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
