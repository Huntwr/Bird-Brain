// server.js
const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
const session = require("express-session");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const multer = require("multer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ------------------ MULTER: bird photo uploads ------------------ */
const birdStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public/uploads/birds"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `bird_${Date.now()}${ext}`);
  }
});
const uploadBird = multer({ storage: birdStorage });

/* ------------------ MULTER: profile picture uploads (existing) ------------------ */
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public/uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // fallback if session not set (shouldn't happen due to isAuthenticated)
    const id = req.session && req.session.user ? req.session.user.id : 'anon';
    cb(null, `profile_${id}${ext}`);
  }
});
const uploadProfile = multer({ storage: profileStorage });

/* ------------------ DB ------------------ */
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.POSTGRES_DB,
});

pool.connect()
  .then(() => console.log("Connected to PostgreSQL DB"))
  .catch(err => console.error("DB connection error:", err));

/* ------------------ Handlebars ------------------ */
app.engine("hbs", exphbs.engine({
  extname: "hbs",
  defaultLayout: "main",
  layoutsDir: path.join(__dirname, "views", "layouts"),
  partialsDir: path.join(__dirname, "views", "partials")
}));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

/* ------------------ Middleware ------------------ */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads"))); // serve uploads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "devsecret",
  resave: false,
  saveUninitialized: false
}));

// expose user & year to templates
app.use((req, res, next) => {
  res.locals.year = new Date().getFullYear();
  res.locals.user = req.session.user;
  next();
});

/* ------------------ Auth middleware ------------------ */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect("/login");
}

/* ------------------ Routes (auth + pages) ------------------ */
app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => res.render("login", { title: "Log In", hideNavbar: true }));
app.get("/signup", (req, res) => res.render("signup", { title: "Sign Up", hideNavbar: true }));

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashed]);
    res.redirect("/login");
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).send("Server error during signup");
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user) {
      return res.send("<script>alert('User does not exist. Try again.'); window.location.href = '/login';</script>");
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.send("<script>alert('Incorrect password. Try again.'); window.location.href = '/login';</script>");
    }
    // keep only the fields we need in session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
      profile_picture: user.profile_picture || "/images/default_pfp.png",
      bio: user.bio
    };
    res.redirect("/home");
  } catch (err) {
    console.error("Login error:", err);
    res.send("<script>alert('Server error. Please try again later.'); window.location.href = '/login';</script>");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

/* ------------------ HOME: load your logs + fake friend logs ------------------ */
app.get("/home", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // fetch your real logs (include photo)
    const q = `
      SELECT id, species, location, sighting_date, notes, photo, created_at
      FROM bird_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const { rows } = await pool.query(q, [userId]);

    // normalize rows for template (format date and default image)
    const logs = rows.map(r => ({
      id: r.id,
      species: r.species,
      location: r.location || "Unknown location",
      sighting_date: r.sighting_date ? new Date(r.sighting_date).toLocaleString() : new Date(r.created_at).toLocaleString(),
      notes: r.notes || "",
      photo: r.photo || "/images/default_bird.png"
    }));

    // fake friend logs (temporary)
    const friendLogs = [
      {
        id: "f1",
        user: "Ava Thompson",
        species: "Blue Jay",
        location: "Denver, CO",
        sighting_date: "Feb 11, 2025 08:12 AM",
        notes: "Loud call, hopping around branches.",
        photo: "/images/sample_bird_1.jpg"
      },
      {
        id: "f2",
        user: "Liam Chen",
        species: "Northern Flicker",
        location: "Boulder Creek",
        sighting_date: "Feb 10, 2025 04:20 PM",
        notes: "Pecking at a log, bright red patch.",
        photo: "/images/sample_bird_2.jpg"
      },
      {
        id: "f3",
        user: "Emily Park",
        species: "Dark-eyed Junco",
        location: "Chautauqua Trail",
        sighting_date: "Feb 08, 2025 09:05 AM",
        notes: "In a group of five, feeding on seeds.",
        photo: "/images/sample_bird_3.jpg"
      }
    ];

    res.render("home", { title: "Home", logs, friendLogs });
  } catch (err) {
    console.error("Home error:", err);
    res.status(500).send("Error loading home feed");
  }
});

/* ------------------ LOG A BIRD (GET + POST with photo) ------------------ */
app.get("/log-bird", isAuthenticated, (req, res) => {
  res.render("log-bird", { title: "Log Bird" });
});

app.post("/log-bird", isAuthenticated, uploadBird.single("photo"), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { species, location, sighting_date, notes } = req.body;

    // ensure required fields
    if (!species) {
      return res.status(400).send("Species is required");
    }

    // handle photo path (if multer didn't receive file, fallback)
    let photoPath = null;
    if (req.file) {
      photoPath = `/uploads/birds/${req.file.filename}`;
    }

    // fallback: if no date given use now
    const finalDate = sighting_date && sighting_date.length ? sighting_date : new Date();

    const insertQ = `
      INSERT INTO bird_logs (user_id, species, location, sighting_date, notes, photo)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(insertQ, [userId, species, location || null, finalDate, notes || null, photoPath]);

    res.redirect("/home");
  } catch (err) {
    console.error("Log bird error:", err);
    res.status(500).send("Failed to log bird: " + (err.message || ""));
  }
});

/* ------------------ PROFILE picture update (kept, using uploadProfile) ------------------ */
app.post("/profile/update", isAuthenticated, uploadProfile.single("profile_picture"), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const bio = req.body.bio || null;

    let profilePicPath = req.session.user.profile_picture || "/images/default_pfp.png";
    if (req.file) profilePicPath = `/uploads/${req.file.filename}`;

    await pool.query("UPDATE users SET profile_picture = $1, bio = $2 WHERE id = $3",
      [profilePicPath, bio, userId]);

    req.session.user.profile_picture = profilePicPath;
    req.session.user.bio = bio;
    req.session.save(() => res.redirect("/profile"));
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).send("Error updating profile");
  }
});

/* ------------------ MAP / COMMENTS / FRIENDS / PROFILE simple pages ------------------ */
app.get("/map", isAuthenticated, (req, res) => res.render("map", { title: "Map" }));
app.get("/comments", isAuthenticated, (req, res) => res.render("comment", { title: "Comments" }));
app.get("/friends", isAuthenticated, (req, res) => res.render("friends", { title: "Friends", user: req.session.user }));
app.get("/profile", isAuthenticated, (req, res) => {
  const user = req.session.user;
  if (!user.profile_picture) user.profile_picture = "/images/default_pfp.png";
  let formattedDate = "";
  if (user.created_at) formattedDate = new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  res.render("profile", { title: "Profile", user: { ...user, formatted_date: formattedDate } });
});

/* ------------------ Config route (mapbox key) ------------------ */
app.get("/config", (req, res) => res.json({ mapboxKey: process.env.MAPBOX_API_KEY }));

/* ------------------ Error handler & server start ------------------ */
app.use((err, req, res, next) => {
  console.error("Unexpected error:", err);
  res.status(500).send("Something went wrong. Please try again later.");
});

app.listen(PORT, () => console.log(`Bird Brain running on http://localhost:${PORT}`));