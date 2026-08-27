// See /api/README.md — re-exports the real implementation in app/api/.
export const config = { runtime: 'edge' };
export { default } from '../../app/api/payments/paystack.js';
