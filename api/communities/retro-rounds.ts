// See /api/README.md — re-exports the real implementation in app/api/.
export const config = { runtime: 'nodejs' };
export { default, GET, POST, OPTIONS } from '../../app/api/communities/retro-rounds.js';
