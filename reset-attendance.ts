import Database from "better-sqlite3";
const db = new Database("attendance.db");
db.prepare("DELETE FROM attendance").run();
console.log("Attendance reset.");
