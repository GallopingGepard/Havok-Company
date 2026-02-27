import Database from "better-sqlite3";
const db = new Database("attendance.db");
db.prepare("UPDATE roster SET team = 'Command' WHERE team = 'Medical'").run();
console.log("Updated team Medical to Command.");
