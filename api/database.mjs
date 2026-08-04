import mysql from "mysql2/promise";
import { config } from "./config.mjs";

export const pool = mysql.createPool({
  ...config.database,
  charset: "utf8mb4",
  timezone: "Z",
  waitForConnections: true,
  enableKeepAlive: true,
  namedPlaceholders: false,
});

export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
