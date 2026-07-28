// See /api/README.md — re-exports the real implementation in app/api/.
export const config = { runtime: 'nodejs' };
export { POST, OPTIONS } from '../../app/api/stellar/verify-payment.js';
