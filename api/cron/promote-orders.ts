// See /api/README.md — re-exports the real implementation in app/api/.
export const config = { runtime: 'nodejs' };
export { GET, POST } from '../../app/api/cron/promote-orders.js';
