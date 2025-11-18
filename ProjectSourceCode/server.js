const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
const session = require("express-session");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();


const multer = require("multer");

// Multer storage for BOTH profile pics and bird photos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "public/uploads"));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });



// support fetch for Node < 18
const fetch = global.fetch || ((...args) =>
  import("node-fetch").then(({ default: f }) => f(...args))
);

// eBird API Key
const EBIRD_API_KEY = process.env.EBIRD_API_KEY;


const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL setup
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
app.use(express.json()); 
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
// ======================
// eBird Species List API
// ======================
app.get("/api/birds/species", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json",
      {
        headers: { "X-eBirdApiToken": EBIRD_API_KEY }
      }
    );

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error("Species list error:", err);
    res.status(500).json({ error: "Failed to fetch species list" });
  }
});


// ======================
// Geocode (text → lat/lng)
// ======================
app.get("/api/geocode", async (req, res) => {
  const text = req.query.text;
  if (!text) return res.json({});

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data || data.length === 0) {
      return res.json({});
    }

    res.json({
      lat: data[0].lat,
      lng: data[0].lon
    });

  } catch (err) {
    console.error("Geocode failed:", err);
    res.json({});
  }
});
// ======================
// Log Bird POST route
// ======================
app.post("/log-bird", upload.single("photo"), async (req, res) => {
  try {
    const { bird, location, time, description, latitude, longitude } = req.body;
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

    const userId = req.session.user.id;

    await pool.query(
      `INSERT INTO bird_sightings (user_id, bird, location, time, description, latitude, longitude, photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, bird, location, time, description, latitude, longitude, photoPath]
    );

    res.redirect("/profile"); // or wherever you want to send them

  } catch (err) {
    console.error("Error logging bird:", err);
    res.status(500).send("Error logging bird.");
  }
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
app.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = result.rows[0]

    if (!user) {
      return res.send("<script>alert('User does not exist. Try again.'); window.location.href = '/login';</script>")
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return res.send("<script>alert('Incorrect password. Try again.'); window.location.href = '/login';</script>")
    }

    req.session.user = { 
      id: user.id, 
      name: user.name, 
      email: user.email,
      created_at: user.created_at,
      profile_picture: user.profile_picture || "/images/default_pfp.png",
      bio: user.bio
    };
    res.redirect('/home')
  } catch (err) {
    console.error('Login error:', err)
    res.send("<script>alert('Server error. Please try again later.'); window.location.href = '/login';</script>")
  }
})

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

app.get("/friends", isAuthenticated, (req, res) => {
  res.render("friends", { 
    title: "Friends",
    user: req.session.user
  });
});

app.get("/profile", isAuthenticated, async (req, res) => {
  const user = req.session.user;

  if (!user.profile_picture) {
    user.profile_picture = "/images/default_pfp.png";
  }

  let formattedDate = "";
  if (user.created_at) {
    const date = new Date(user.created_at);
    formattedDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  res.render("profile", {
    title: "Profile",
    user: {
      ...user,
      formatted_date: formattedDate
    }
  });
});

app.post("/profile/update", isAuthenticated, upload.single("profile_picture"), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const bio = req.body.bio;

    let profilePicPath = req.session.user.profile_picture;

    if (req.file) {
      profilePicPath = `/uploads/${req.file.filename}`;
    }

    await pool.query(
      "UPDATE users SET profile_picture = $1, bio = $2 WHERE id = $3",
      [profilePicPath, bio, userId]
    );

    req.session.user.profile_picture = profilePicPath;
    req.session.user.bio = bio;

    res.redirect("/profile");

  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).send("Error updating profile");
  }
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

// Check if username exists
app.get("/api/users/check/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    
    const result = await pool.query(
      "SELECT id, username FROM users WHERE LOWER(username) = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        exists: false, 
        message: `Username "${req.params.username}" does not exist.` 
      });
    }

    res.json({
      exists: true,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username
      }
    });
  } catch (err) {
    console.error("Error checking username:", err);
    res.status(500).json({ 
      exists: false, 
      message: "Unable to verify username. Please try again." 
    });
  }
});

// Check if email exists
app.get("/api/users/check-email/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    

    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE LOWER(email) = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        exists: false, 
        message: `Email "${req.params.email}" does not exist.` 
      });
    }

    res.json({
      exists: true,
      user: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email
      }
    });
  } catch (err) {
    console.error("Error checking email:", err);
    res.status(500).json({ 
      exists: false, 
      message: "Unable to verify email. Please try again." 
    });
  }
});

// Friend Request API endpoints
app.post("/api/friends/request", isAuthenticated, async (req, res) => {
  try {
    const { recipientEmail } = req.body;
    
    if (!recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        message: "Recipient email is required" 
      });
    }
    
    const senderId = req.session.user.id;
    const senderName = req.session.user.name;
    const senderEmail = req.session.user.email;
    
    const recipientResult = await pool.query("SELECT id, name, email FROM users WHERE LOWER(email) = $1", [recipientEmail.toLowerCase()]);
    
    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    
    const recipient = recipientResult.rows[0];
    
    if (recipient.id === senderId) {
      return res.status(400).json({
        success: false,
        message: "You cannot send a friend request to yourself"
      });
    }
    
    res.json({
      success: true,
      message: `Friend request sent to ${recipient.name}`,
      request: {
        id: Date.now(),
        senderId: senderId,
        senderName: senderName,
        senderEmail: senderEmail,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        status: 'pending',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Error sending friend request:", err);
    res.status(500).json({ 
      success: false, 
      message: "Unable to send friend request" 
    });
  }
});

// Get incoming friend requests for current user
app.get("/api/friends/requests/incoming", isAuthenticated, (req, res) => {
  res.json([]);
});

// Mapbox API Key route
app.get("/config", (req, res) => {
  res.json({
    mapboxKey: process.env.MAPBOX_API_KEY
  });
});

// Get outgoing friend requests for current user  
app.get("/api/friends/requests/outgoing", isAuthenticated, (req, res) => {
  res.json([]);
});


// Bird Suggestion Route (eBird API)
app.get("/api/bird-suggestions", isAuthenticated, async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing coordinates" });
  }

  try {
    const response = await fetch(
      `https://api.ebird.org/v2/data/obs/geo/recent?lat=${lat}&lng=${lng}`,
      {
        headers: {
          "X-eBirdApiToken": EBIRD_API_KEY
        }
      }
    );

    const data = await response.json();

    const cleaned = data.map(b => ({
      speciesCode: b.speciesCode,
      name: b.comName,
      sciName: b.sciName
    }));

    res.json(cleaned);

  } catch (err) {
    console.error("Bird API error:", err);
    res.status(500).json({ error: "Failed to fetch bird suggestions" });
  }
});

app.use((err, req, res, next) => {
  console.error('Unexpected error:', err)
  res.status(500).send('Something went wrong. Please try again later.')
})


// Start server
app.listen(PORT, () => console.log(`Bird Brain running on http://localhost:${PORT}`));
