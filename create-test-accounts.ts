import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const db = new Database("attendance.db");

const passwordHash = bcrypt.hashSync("1234", 10);

// Create GuestTest01
try {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("GuestTest01", passwordHash, "guest");
  console.log("Created GuestTest01 account.");
} catch (e) {
  console.log("GuestTest01 might already exist.");
}

// Create MemberTest01
try {
  // Add to roster first
  const rosterResult = db.prepare("INSERT INTO roster (name, rank, squad, team, role, mos_abr) VALUES (?, ?, ?, ?, ?, ?)").run(
    "MemberTest01", "Private", "1-3", "Reserves", "Rifleman", "R"
  );
  
  // Add to users
  db.prepare("INSERT INTO users (username, password, role, roster_id) VALUES (?, ?, ?, ?)").run(
    "MemberTest01", passwordHash, "member", rosterResult.lastInsertRowid
  );
  console.log("Created MemberTest01 account and roster entry.");
} catch (e) {
  console.log("MemberTest01 might already exist.");
}
