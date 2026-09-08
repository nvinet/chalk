// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init_schema.sql';
import m0001 from './0001_one_session_in_progress.sql';
import m0002 from './0002_skip_a_muscle_group.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002
    }
  }
  