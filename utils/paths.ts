import path from 'path';

/** Where auth.setup.ts saves the logged-in session for the other tests to reuse. */
export const STORAGE_STATE = path.join(__dirname, '..', '.auth', 'user.json');
