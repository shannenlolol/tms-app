//  * MySQL connection pool (mysql2/promise) initialised from environment variables.
//  * Exported pool is shared across controllers for queries.

import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;            // <— default export
export { pool };                // optional named export
