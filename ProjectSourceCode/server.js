const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
const session = require("express-session");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL setup
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

pool.connect()
  .then(() => console.log("Connected to PostgreSQL DB"))
  .catch(err => console.error("DB connection error:", err));

// Handlebars setup
app.engine("hbs", exphbs.engine({
  extname: "hbs",
  defaultLayout: "main",
  layoutsDir: path.join(__dirname, "views", "layouts"),
  partialsDir: path.join(__dirname, "views", "partials")
}));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use((req, res, next) => {
  res.locals.year = new Date().getFullYear();
  res.locals.user = req.session.user;
  next();
});

// Auth middleware
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// Routes

// Redirect root to login
app.get("/", (req, res) => {
  res.redirect("/login");
});

// Login & Signup pages
app.get("/login", (req, res) => {
  res.render("login", { title: "Log In", hideNavbar: true });
});

app.get("/signup", (req, res) => {
  res.render("signup", { title: "Sign Up", hideNavbar: true });
});

// Signup POST
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashed]
    );
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Login POST
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(401).send("Invalid login");

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send("Invalid login");

    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect("/home");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Protected pages
app.get("/home", isAuthenticated, (req, res) => {
  res.render("home", { title: "Home" });
});

app.get("/log-bird", isAuthenticated, (req, res) => {
  res.render("log-bird", { title: "Log Bird" });
});

app.get("/comments", isAuthenticated, (req, res) => {
  res.render("comment", { title: "Comments" });
});

// API Routes
app.get("/api/user", isAuthenticated, (req, res) => {
  res.json({
    id: req.session.user.id,
    name: req.session.user.name,
    email: req.session.user.email,
    birdsLogged: 42
  });
});

app.get("/api/git", async (req, res) => {
  try {
    const data = [
      { repo: "birdbrain-frontend", stars: 5 },
      { repo: "birdbrain-backend", stars: 3 }
    ];
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Git data" });
  }
});

// Start server
app.listen(PORT, () => console.log(`Bird Brain running on http://localhost:${PORT}`));