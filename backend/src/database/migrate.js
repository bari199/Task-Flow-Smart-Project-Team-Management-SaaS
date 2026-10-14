import "dotenv/config";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "../config/database.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const migrationsDirectory = path.join(currentDirectory, "migrations");

const runMigrations = async () => {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock($1)", [741852963]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    const { rows } = await client.query(
      "SELECT filename FROM schema_migrations",
    );

    const applied = new Set(rows.map((row) => row.filename));

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`Skipping already applied: ${filename}`);
        continue;
      }

      const sql = await readFile(
        path.join(migrationsDirectory, filename),
        "utf8",
      );

      console.log(`Applying migration: ${filename}`);

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [filename],
        );

        await client.query("COMMIT");
        console.log(`Applied successfully: ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Database migrations completed.");
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock($1)", [741852963]);
    }

    client.release();
    await pool.end();
  }
};

runMigrations().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
