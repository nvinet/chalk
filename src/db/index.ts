export { db, expoDb, DATABASE_NAME } from './client';
export { applyCatalogueSeed, catalogueCounts, type CatalogueCounts } from './seed-runner';
export {
  appliedMigrationCount,
  useCatalogueState,
  useMigrationState,
  type CatalogueState,
  type MigrationState,
} from './migrate';

// Re-exported so screens have one import for data access and do not each reach
// into drizzle-orm internals.
export { useLiveQuery } from 'drizzle-orm/expo-sqlite';
