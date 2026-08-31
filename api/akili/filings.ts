// See /api/README.md — re-exports the real implementation in app/api/.
export const config = { runtime: 'nodejs' };
export { default, POST, OPTIONS } from '../../app/api/akili/filings.js';
