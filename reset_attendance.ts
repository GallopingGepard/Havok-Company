
import Database from "better-sqlite3";
const db = new Database("attendance.db");

console.log("Resetting attendance tracker and mission signups...");

try {
  const result = db.prepare("DELETE FROM attendance").run();
  console.log(`Successfully cleared attendance table. Removed ${result.changes} records.`);
} catch (err) {
  console.error("Failed to clear attendance table:", err);
}

process.exit(0);
