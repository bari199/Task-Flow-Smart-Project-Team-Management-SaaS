import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

export const connectDatabase = async () => {
  const result = await pool.query(
    "SELECT current_database() AS database, NOW() AS server_time",
  );

  console.log(`PostgreSQL connected: ${result.rows[0].database}`);

  return result.rows[0];
};
