// See /api/README.md — re-exports the real implementation in app/api/.
export const config = { runtime: 'nodejs' };
export { default } from '../../app/api/mpesa/transaction-status.js';
