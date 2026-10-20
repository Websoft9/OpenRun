import { openDatabase, getDatabasePath } from '../db/database.js'
import { runMigrations } from '../db/migrate.js'
import { seedReferenceData } from '../db/seed.js'

const reset = process.argv.includes('--reset')

const db = openDatabase()

if (reset) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS submission_events;
    DROP TABLE IF EXISTS submissions;
    DROP TABLE IF EXISTS category_parents;
    DROP TABLE IF EXISTS software_analysis_translations;
    DROP TABLE IF EXISTS software_translations;
    DROP TABLE IF EXISTS category_translations;
    DROP TABLE IF EXISTS tag_translations;
    DROP TABLE IF EXISTS search_index;
    DROP TABLE IF EXISTS provenance;
    DROP TABLE IF EXISTS analyses;
    DROP TABLE IF EXISTS software_tags;
    DROP TABLE IF EXISTS tags;
    DROP TABLE IF EXISTS software_categories;
    DROP TABLE IF EXISTS software;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS software_processes;
    DROP TABLE IF EXISTS process_nodes;
    DROP TABLE IF EXISTS process_frameworks;
    DROP TABLE IF EXISTS software_industries;
    DROP TABLE IF EXISTS industries;
    DROP TABLE IF EXISTS software_platforms;
    DROP TABLE IF EXISTS platforms;
    DROP TABLE IF EXISTS software_markets;
    DROP TABLE IF EXISTS markets;
    DROP TABLE IF EXISTS languages;
    DROP TABLE IF EXISTS licenses;
    DROP TABLE IF EXISTS difficulty_levels;
    DROP TABLE IF EXISTS reserved_tags;
    DROP TABLE IF EXISTS schema_migrations;
    PRAGMA foreign_keys = ON;
  `)
}

const migrationResult = runMigrations(db)
seedReferenceData(db)

const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get() as { count: number }
const licenseCount = db.prepare('SELECT COUNT(*) AS count FROM licenses').get() as { count: number }
const languageCount = db.prepare('SELECT COUNT(*) AS count FROM languages').get() as { count: number }
const softwareCount = db.prepare('SELECT COUNT(*) AS count FROM software').get() as { count: number }

console.log(`Database ready at ${getDatabasePath()}`)
console.log(`Applied migrations: ${migrationResult.applied.length > 0 ? migrationResult.applied.join(', ') : 'none'}`)
console.log(`Reference data: ${categoryCount.count} categories, ${licenseCount.count} licenses, ${languageCount.count} languages`)
console.log(`Catalog currently contains ${softwareCount.count} software records (reference seed does not create products)`)

db.close()
