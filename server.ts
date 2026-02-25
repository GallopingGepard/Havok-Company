import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import session from "express-session";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("attendance.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    roster_id INTEGER,
    role TEXT DEFAULT 'member',
    FOREIGN KEY (roster_id) REFERENCES roster (id)
  );

  CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    debrief TEXT,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'upcoming',
    location TEXT,
    situation TEXT,
    objectives TEXT,
    env_terrain TEXT,
    env_time TEXT,
    env_weather TEXT,
    env_forecast TEXT
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    FOREIGN KEY (mission_id) REFERENCES missions (id)
  );

  CREATE TABLE IF NOT EXISTS roster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    rank TEXT,
    squad TEXT,
    team TEXT,
    role TEXT,
    mos_abr TEXT,
    display_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    squad TEXT,
    status TEXT DEFAULT 'Attending',
    signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mission_id) REFERENCES missions (id)
  );
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN roster_id INTEGER REFERENCES roster(id);");
} catch (e) {
  // Column might already exist
}

try {
  db.exec("ALTER TABLE roster ADD COLUMN display_order INTEGER DEFAULT 0;");
} catch (e) {
  // Column might already exist
}

// Add new mission columns if they don't exist
const missionColumns = [
  "location", "situation", "objectives", 
  "env_terrain", "env_time", "env_weather", "env_forecast"
];

missionColumns.forEach(col => {
  try {
    db.exec(`ALTER TABLE missions ADD COLUMN ${col} TEXT;`);
  } catch (e) {
    // Column might already exist
  }
});

// Seed admin user if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const hashedPassword = bcrypt.hashSync("admin", 10);
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", hashedPassword, "admin");
  
  // Seed requested admins with no password (using a placeholder that we'll bypass)
  const emptyHash = bcrypt.hashSync("nopassword", 10);
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("B.Gepard", emptyHash, "admin");
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("A.Stone", emptyHash, "admin");
}

// Seed roster if empty
const rosterCount = db.prepare("SELECT COUNT(*) as count FROM roster").get() as { count: number };
if (rosterCount.count === 0) {
  const members = [
    // ... (rest of the members seeding code remains the same)
    // 1-HQ
    { name: "A.Stone", rank: "1st Lieutenant", squad: "1-HQ", team: "Command", role: "Commanding Officer", mos_abr: "CO" },
    { name: "B.Gepard", rank: "2nd Lieutenant", squad: "1-HQ", team: "Command", role: "Executive Officer", mos_abr: "XO" },
    { name: "B.Reyes", rank: "Master Sergeant", squad: "1-HQ", team: "Medical", role: "Platoon Corpsman", mos_abr: "PC" },
    
    // 1-1 HQ
    { name: "A.Fish", rank: "1st Lieutenant", squad: "1-1", team: "Command", role: "Squad Leader", mos_abr: "SL" },
    { name: "M.Stabler", rank: "2nd Lieutenant", squad: "1-1", team: "Command", role: "Corpsman", mos_abr: "C" },

    // 1-1 Alpha
    { name: "X.Neovorsky", rank: "Lance Corporal", squad: "1-1", team: "Alpha", role: "Fireteam Lead", mos_abr: "FTL" },
    { name: "R.Cooper", rank: "Private First Class", squad: "1-1", team: "Alpha", role: "Breacher", mos_abr: "B" },
    { name: "B.Hags", rank: "Private First Class", squad: "1-1", team: "Alpha", role: "Rifleman", mos_abr: "R" },
    { name: "K.Griffin", rank: "Private First Class", squad: "1-1", team: "Alpha", role: "Rifleman", mos_abr: "R" },
    { name: "T.Kane", rank: "Private First Class", squad: "1-1", team: "Alpha", role: "Rifleman", mos_abr: "R" },
    
    // 1-1 Bravo
    { name: "L.Skynyrd", rank: "Lance Corporal", squad: "1-1", team: "Bravo", role: "Fireteam Lead", mos_abr: "FTL" },
    { name: "A.Fox", rank: "Private First Class", squad: "1-1", team: "Bravo", role: "Marksman", mos_abr: "M" },
    { name: "F.Wombat", rank: "Private First Class", squad: "1-1", team: "Bravo", role: "Rifleman Anti-Tank", mos_abr: "AT" },
    { name: "G.Mavros", rank: "Private First Class", squad: "1-1", team: "Bravo", role: "Automatic Rifleman", mos_abr: "AR" },
    { name: "C.Dancer", rank: "Private First Class", squad: "1-1", team: "Bravo", role: "Rifleman", mos_abr: "R" },

    // 1-2 HQ
    { name: "A.Smith", rank: "Sergeant Major", squad: "1-2", team: "Command", role: "Squad Leader", mos_abr: "SL" },
    { name: "S.O'Neill", rank: "Master Gunnery Sergeant", squad: "1-2", team: "Command", role: "Corpsman", mos_abr: "C" },

    // 1-2 Alpha
    { name: "S.King", rank: "Lance Corporal", squad: "1-2", team: "Alpha", role: "Fireteam Lead", mos_abr: "FTL" },
    { name: "A.Nicolson", rank: "Private First Class", squad: "1-2", team: "Alpha", role: "Breacher", mos_abr: "B" },
    { name: "A.Louie", rank: "Private First Class", squad: "1-2", team: "Alpha", role: "Grenadier", mos_abr: "G" },
    { name: "D.Fuegos", rank: "Private First Class", squad: "1-2", team: "Alpha", role: "Rifleman", mos_abr: "R" },
    { name: "D.Romanov", rank: "Private First Class", squad: "1-2", team: "Alpha", role: "Rifleman", mos_abr: "R" },

    // 1-2 Bravo
    { name: "G.Mitchell", rank: "Lance Corporal", squad: "1-2", team: "Bravo", role: "Fireteam Lead", mos_abr: "FTL" },
    { name: "L.Rose", rank: "Private First Class", squad: "1-2", team: "Bravo", role: "Marksman", mos_abr: "M" },
    { name: "W.Pope", rank: "Private First Class", squad: "1-2", team: "Bravo", role: "Rifleman Anti-Tank", mos_abr: "AT" },
    { name: "D.Alek", rank: "Private First Class", squad: "1-2", team: "Bravo", role: "Automatic Rifleman", mos_abr: "AR" },
    { name: "I.Simmons", rank: "Private First Class", squad: "1-2", team: "Bravo", role: "Rifleman", mos_abr: "R" },

    // 1-3 Reserves
    { name: "A.Kelp", rank: "Private", squad: "1-3", team: "Reserves", role: "Reservist", mos_abr: "R" },
    { name: "M.Robinson", rank: "Private", squad: "1-3", team: "Reserves", role: "Reservist", mos_abr: "R" },
    { name: "J.Miller", rank: "Private", squad: "1-3", team: "Reserves", role: "Reservist", mos_abr: "R" },
    { name: "A.Watts", rank: "Private", squad: "1-3", team: "Reserves", role: "Reservist", mos_abr: "R" },
    { name: "E.Morales", rank: "Private", squad: "1-3", team: "Reserves", role: "Reservist", mos_abr: "R" },
    { name: "A.Atom", rank: "Private", squad: "1-3", team: "Reserves", role: "Reservist", mos_abr: "R" },
    { name: "C.Oblansk", rank: "Private", squad: "1-3", team: "Reserves", role: "Reservist", mos_abr: "R" },
    { name: "J.Wolf", rank: "Private", squad: "1-3", team: "Reserves", role: "Reservist", mos_abr: "R" },
  ];

  const insert = db.prepare("INSERT INTO roster (name, rank, squad, team, role, mos_abr) VALUES (?, ?, ?, ?, ?, ?)");
  members.forEach(m => insert.run(m.name, m.rank, m.squad, m.team, m.role, m.mos_abr));
}

// Ensure specific member updates from user request
db.prepare("UPDATE roster SET squad = '1-1' WHERE name = 'A.Fish'").run();
db.prepare("UPDATE roster SET squad = '1-1', role = 'Corpsman', mos_abr = 'C' WHERE name = 'M.Stabler'").run();
db.prepare("UPDATE roster SET role = 'Corpsman', mos_abr = 'C' WHERE name = 'S.O''Neill'").run();


// Seed initial missions if empty
const missionCount = db.prepare("SELECT COUNT(*) as count FROM missions").get() as { count: number };
if (missionCount.count === 0) {
  const missions = [
    {
      title: "OPERATION CONDOR: MISSION 4 'GHOSTSTALKERS'",
      location: "Castiglione, Escala III",
      situation: `Four days have passed since UNSC forces conducted successful retrograde and reconsolidation operations west of Castiglione City, inflicting heavy losses on the advancing 1st Armoured Division (Brigade). Despite already low strength and readiness, due to Havok companies efforts the 23rd ACR has become a serious thorn in the side for Escalan forces.

With both sides now relatively evenly matched one thing stands in the way of any offensive operations, drones. Despite having a few fixed wing aircraft the majority of the Escalan air force consists of a fleet of F-99 Wombat Unmanned Aerial vehicles, although UNSC forces have moved out of the range of these UAV's they must be destroyed.

Colonel Anderson has devised a daring plan to eliminate a large pool of these drones and their munitions at Lento Airbase and with the help of the famed 16th Special Operations Aviation Regiment "Ghoststalkers". (Attached to the 23rd since their evacuation from New Constantinople), Havok will get it done.

Havok, with the assistance of the 16th SOAR, will conduct a raid on Lento Airbase destroying FEG aircraft and equipment.`,
      objectives: JSON.stringify([
        "Insert to LZ Alpha and Bravo via Ghost/Darkstar flight.",
        "1-1 Tasking: Move from LZ Alpha to plant explosives on F-99's and accompanying equipment, clearing the eastern side of the airfield as they go.",
        "1-2 Tasking: Move from LZ Bravo and set up SBF positions watching the runway and south road, any scrambling aircraft must be destroyed.",
        "Rally: Once all identified F-99's have been destroyed the platoon will rally at the terminal.",
        "Clearance: The platoon will then clear the airbase of hostile personnel and destroy any equipment before any hostile QRF can reinforce the airbase.",
        "Exfil: Once the base is cleared, Havok will exfil from the AO at LZ Charlie."
      ]),
      env_terrain: "Temperate Forest & Airbase",
      env_time: "07:30 Military Standard Time",
      env_weather: "Cloudy",
      env_forecast: "Cloudy",
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // In 2 days
    }
  ];

  const insertMission = db.prepare(`
    INSERT INTO missions (
      title, location, situation, objectives, 
      env_terrain, env_time, env_weather, env_forecast, date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  missions.forEach(m => insertMission.run(
    m.title, m.location, m.situation, m.objectives,
    m.env_terrain, m.env_time, m.env_weather, m.env_forecast, m.date
  ));

  // Seed some historical attendance for stats demonstration
  const roster = db.prepare("SELECT name FROM roster").all() as { name: string }[];
  const missionIds = db.prepare("SELECT id FROM missions").all() as { id: number }[];
  
  const insertAttendance = db.prepare("INSERT INTO attendance (mission_id, name, role, squad, status, signed_at) VALUES (?, ?, ?, ?, ?, ?)");
  
  roster.forEach((member, idx) => {
    // Mission 1 (2 weeks ago)
    if (idx % 2 === 0) {
      insertAttendance.run(missionIds[0].id, member.name, "Rifleman", "1-1", "Attended", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
    }
    // Mission 2 (1 week ago)
    if (idx % 3 !== 0) {
      insertAttendance.run(missionIds[1].id, member.name, "Rifleman", "1-1", "Attended", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    }
  });
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const PORT = 3000;

  app.use(express.json());
  app.use(session({
    secret: "havok-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      sameSite: "none",
      httpOnly: true,
    }
  }));

  // WebSocket broadcast helper
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // Configure Multer for file uploads
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ storage });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadDir));

  // Auth Routes
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    
    let user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    
    // Special case for B.Gepard and A.Stone: no password check
    const isSpecialAdmin = username === "B.Gepard" || username === "A.Stone";

    if (!user) {
      if (isSpecialAdmin) {
        const emptyHash = bcrypt.hashSync("nopassword", 10);
        const result = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, emptyHash, "admin");
        user = { id: result.lastInsertRowid, username, role: "admin" };
      } else {
        // Members must have an account created for them by admins
        return res.status(401).json({ error: "Account not found. Please contact an administrator." });
      }
    } else {
      // If user exists, check password UNLESS it's a special admin
      // For now, do not require any passwords to login as requested.
      // if (!isSpecialAdmin) {
      //   const valid = bcrypt.compareSync(password, user.password);
      //   if (!valid) {
      //     return res.status(401).json({ error: "Invalid credentials" });
      //   }
      // }
    }
    
    (req.session as any).userId = user.id;
    (req.session as any).username = user.username;
    (req.session as any).role = user.role;
    res.json({ id: user.id, username: user.username, role: user.role });
  });

  app.get("/api/auth/me", (req, res) => {
    if ((req.session as any).userId) {
      res.json({
        id: (req.session as any).userId,
        username: (req.session as any).username,
        role: (req.session as any).role
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.post("/api/auth/change-password", (req, res) => {
    if (!(req.session as any).userId || (req.session as any).userId === -1) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { newPassword } = req.body;
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, (req.session as any).userId);
    res.json({ success: true });
  });

  // API Routes
  app.get("/api/missions", (req, res) => {
    const missions = db.prepare("SELECT * FROM missions ORDER BY date ASC").all();
    res.json(missions);
  });

  app.get("/api/roster", (req, res) => {
    const roster = db.prepare("SELECT * FROM roster ORDER BY display_order ASC").all();
    res.json(roster);
  });

  // Admin Middleware
  const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((req.session as any).role === "admin") {
      next();
    } else {
      res.status(403).json({ error: "Unauthorized" });
    }
  };

  // Admin User Management Routes
  app.get("/api/users", isAdmin, (req, res) => {
    const users = db.prepare("SELECT id, username, role, roster_id FROM users").all();
    res.json(users);
  });

  app.post("/api/users", isAdmin, (req, res) => {
    const { username, password, role, roster_id } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db.prepare("INSERT INTO users (username, password, role, roster_id) VALUES (?, ?, ?, ?)").run(username, hashedPassword, role, roster_id);
      res.json({ id: result.lastInsertRowid });
    } catch (err) {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.put("/api/users/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    const { username, password, role, roster_id } = req.body;
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare("UPDATE users SET username = ?, password = ?, role = ?, roster_id = ? WHERE id = ?").run(username, hashedPassword, role, roster_id, id);
    } else {
      db.prepare("UPDATE users SET username = ?, role = ?, roster_id = ? WHERE id = ?").run(username, role, roster_id, id);
    }
    res.json({ success: true });
  });

  app.delete("/api/users/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Admin Roster Routes
  app.post("/api/roster", isAdmin, (req, res) => {
    const { name, rank, squad, team, role, mos_abr } = req.body;
    try {
      const maxOrder = db.prepare("SELECT MAX(display_order) as maxOrder FROM roster WHERE squad = ?").get(squad) as { maxOrder: number };
      const display_order = (maxOrder?.maxOrder || 0) + 1;
      const result = db.prepare("INSERT INTO roster (name, rank, squad, team, role, mos_abr, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)").run(name, rank, squad, team, role, mos_abr, display_order);
      res.json({ id: result.lastInsertRowid });
    } catch (err) {
      res.status(400).json({ error: "Failed to add member" });
    }
  });

  app.put("/api/roster/reorder", isAdmin, (req, res) => {
    const { members } = req.body; // Array of { id, display_order, squad, team }
    const updateRoster = db.prepare("UPDATE roster SET display_order = ?, squad = ?, team = ? WHERE id = ?");
    const updateAttendance = db.prepare("UPDATE attendance SET squad = ? WHERE name = (SELECT name FROM roster WHERE id = ?)");
    const transaction = db.transaction((items) => {
      for (const item of items) {
        updateRoster.run(item.display_order, item.squad, item.team, item.id);
        updateAttendance.run(item.squad, item.id);
      }
    });
    transaction(members);
    res.json({ success: true });
  });

  app.put("/api/roster/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    const { name, rank, squad, team, role, mos_abr } = req.body;
    
    const oldMember = db.prepare("SELECT name FROM roster WHERE id = ?").get(id) as { name: string };
    
    db.prepare("UPDATE roster SET name = ?, rank = ?, squad = ?, team = ?, role = ?, mos_abr = ? WHERE id = ?").run(name, rank, squad, team, role, mos_abr, id);
    
    if (oldMember && oldMember.name !== name) {
      db.prepare("UPDATE attendance SET name = ?, squad = ?, role = ? WHERE name = ?").run(name, squad, role, oldMember.name);
      db.prepare("UPDATE users SET username = ? WHERE username = ?").run(name, oldMember.name);
    } else {
      db.prepare("UPDATE attendance SET squad = ?, role = ? WHERE name = ?").run(squad, role, name);
    }
    
    res.json({ success: true });
  });

  app.delete("/api/roster/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM roster WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.put("/api/missions/:id/debrief", isAdmin, (req, res) => {
    const { id } = req.params;
    const { debrief } = req.body;
    db.prepare("UPDATE missions SET debrief = ? WHERE id = ?").run(debrief, id);
    res.json({ success: true });
  });

  // Admin Mission Routes
  app.post("/api/missions", isAdmin, (req, res) => {
    const { 
      title, location, situation, objectives, 
      env_terrain, env_time, env_weather, env_forecast, date 
    } = req.body;
    const result = db.prepare(`
      INSERT INTO missions (
        title, location, situation, objectives, 
        env_terrain, env_time, env_weather, env_forecast, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, location, situation, objectives, 
      env_terrain, env_time, env_weather, env_forecast, date
    );
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/missions/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    const { 
      title, location, situation, objectives, 
      env_terrain, env_time, env_weather, env_forecast, date, status, debrief 
    } = req.body;
    
    if (status) {
      db.prepare(`
        UPDATE missions SET 
          title = ?, location = ?, situation = ?, objectives = ?, 
          env_terrain = ?, env_time = ?, env_weather = ?, env_forecast = ?, 
          date = ?, status = ?, debrief = ? 
        WHERE id = ?
      `).run(
        title, location, situation, objectives, 
        env_terrain, env_time, env_weather, env_forecast, 
        date, status, debrief, id
      );
    } else {
      db.prepare(`
        UPDATE missions SET 
          title = ?, location = ?, situation = ?, objectives = ?, 
          env_terrain = ?, env_time = ?, env_weather = ?, env_forecast = ?, 
          date = ?, debrief = ? 
        WHERE id = ?
      `).run(
        title, location, situation, objectives, 
        env_terrain, env_time, env_weather, env_forecast, 
        date, debrief, id
      );
    }
    res.json({ success: true });
  });

  app.put("/api/missions/:id/complete", isAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE missions SET status = 'completed' WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.delete("/api/missions/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM missions WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/missions/:id/attachments", (req, res) => {
    const attachments = db.prepare("SELECT * FROM attachments WHERE mission_id = ?").all(req.params.id);
    res.json(attachments);
  });

  app.post("/api/missions/:id/attachments", isAdmin, upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const { id } = req.params;
    const result = db.prepare(`
      INSERT INTO attachments (mission_id, filename, original_name, mime_type, size)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size);
    
    res.json({ id: result.lastInsertRowid, filename: req.file.filename, original_name: req.file.originalname });
  });

  app.delete("/api/attachments/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    const attachment = db.prepare("SELECT filename FROM attachments WHERE id = ?").get(id) as { filename: string } | undefined;
    if (attachment) {
      const filePath = path.join(uploadDir, attachment.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      db.prepare("DELETE FROM attachments WHERE id = ?").run(id);
    }
    res.json({ success: true });
  });

  app.get("/api/attendance", (req, res) => {
    const attendance = db.prepare("SELECT * FROM attendance").all();
    res.json(attendance);
  });

  app.get("/api/missions/:id/attendance", (req, res) => {
    const attendance = db.prepare("SELECT * FROM attendance WHERE mission_id = ?").all(req.params.id);
    res.json(attendance);
  });

  app.put("/api/attendance/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare("UPDATE attendance SET status = ? WHERE id = ?").run(status, id);
    
    // Fetch the updated record to broadcast
    const entry = db.prepare("SELECT * FROM attendance WHERE id = ?").get(id);
    broadcast({ type: 'SIGNUP_UPDATE', entry, missionId: entry.mission_id });
    
    res.json({ success: true });
  });

  app.post("/api/missions/:id/signup", (req, res) => {
    const { name, status } = req.body;
    let { role, squad } = req.body;
    const missionId = req.params.id;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Try to find member in roster to get their squad and role if not provided
    if (!role || !squad) {
      const member = db.prepare("SELECT role, squad FROM roster WHERE name = ?").get(name) as { role: string, squad: string } | undefined;
      if (member) {
        role = role || member.role;
        squad = squad || member.squad;
      } else {
        role = role || "Guest";
        squad = squad || "Guest";
      }
    }

    try {
      // Check if already signed up
      const existing = db.prepare("SELECT id FROM attendance WHERE mission_id = ? AND name = ?").get(missionId, name) as { id: number } | undefined;
      
      let newEntry;
      if (existing) {
        db.prepare("UPDATE attendance SET role = ?, squad = ?, status = ? WHERE id = ?").run(role, squad, status || 'Attending', existing.id);
        newEntry = { id: existing.id, mission_id: missionId, name, role, squad, status: status || 'Attending', signed_at: new Date().toISOString() };
      } else {
        const result = db.prepare("INSERT INTO attendance (mission_id, name, role, squad, status) VALUES (?, ?, ?, ?, ?)").run(missionId, name, role, squad, status || 'Attending');
        newEntry = { id: result.lastInsertRowid, mission_id: missionId, name, role, squad, status: status || 'Attending', signed_at: new Date().toISOString() };
      }
      
      broadcast({ type: "SIGNUP_UPDATE", missionId, entry: newEntry });
      res.json(newEntry);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to sign up" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
