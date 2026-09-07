export { db, expoDb, DATABASE_NAME } from './client';

// Re-exported so screens have one import for data access and do not each reach
// into drizzle-orm internals.
export { useLiveQuery } from 'drizzle-orm/expo-sqlite';
