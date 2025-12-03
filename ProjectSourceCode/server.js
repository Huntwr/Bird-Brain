const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
const session = require("express-session");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
// Mapbox API Key route
app.get("/config", (req, res) => {
  res.json({
    mapboxKey: process.env.MAPBOX_API_KEY
  });
});
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
const MAPBOX_TOKEN = process.env.MAPBOX_API_KEY;

// Test endpoint to check Mapbox API key
app.get("/api/geocode/test", async (req, res) => {
  if (!MAPBOX_TOKEN) {
    return res.json({ 
      error: "MAPBOX_API_KEY not set",
      suggestion: "Add MAPBOX_API_KEY to your .env file"
    });
  }

  // Test with a simple query
  const testUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/Boulder.json?access_token=${MAPBOX_TOKEN}&limit=1`;
  
  try {
    const response = await fetch(testUrl);
    const contentType = response.headers.get("content-type") || "";
    const bodyText = await response.text();
    
    return res.json({
      status: response.status,
      contentType: contentType,
      hasJson: contentType.includes("application/json"),
      bodyPreview: bodyText.slice(0, 300),
      apiKeyLength: MAPBOX_TOKEN.length,
      apiKeyPrefix: MAPBOX_TOKEN.substring(0, 10) + "..."
    });
  } catch (err) {
    return res.json({
      error: err.message,
      suggestion: "Check your Mapbox API key or use OpenStreetMap fallback"
    });
  }
});

app.get("/api/geocode", async (req, res) => {
  const text = req.query.text;
  if (!text) {
    return res.json({ error: "No location text provided" });
  }

  // Helper function to use OpenStreetMap Nominatim (free, no API key)
  async function geocodeWithOpenStreetMap(query) {
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const osmResponse = await fetch(osmUrl, {
        headers: {
          'User-Agent': 'Bird-Brain-App/1.0' // Required by Nominatim
        }
      });
      
      if (osmResponse.ok) {
        const osmData = await osmResponse.json();
        if (osmData && osmData.length > 0) {
          const result = osmData[0];
          return {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            place_name: result.display_name || query,
            source: "OpenStreetMap"
          };
        }
      }
    } catch (err) {
      console.error("OpenStreetMap geocoding error:", err);
    }
    return null;
  }

  try {
    // If no Mapbox token, use OpenStreetMap directly
    if (!MAPBOX_TOKEN) {
      console.log("MAPBOX_API_KEY not set, using OpenStreetMap...");
      const osmResult = await geocodeWithOpenStreetMap(text);
      if (osmResult) {
        return res.json(osmResult);
      }
      return res.json({ error: "Could not geocode location. Please try a more specific address." });
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      text
    )}.json?access_token=${MAPBOX_TOKEN}&limit=1`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Mapbox API error (${response.status}):`, errorText.slice(0, 500));
      console.log("Falling back to OpenStreetMap...");
      
      // Fallback to OpenStreetMap
      const osmResult = await geocodeWithOpenStreetMap(text);
      if (osmResult) {
        return res.json(osmResult);
      }
      
      return res.json({ 
        error: `Geocoding failed: ${response.status} ${response.statusText}`,
        details: errorText.slice(0, 200)
      });
    }

    const contentType = response.headers.get("content-type") || "";

    // Read the body once as text so we can handle both JSON and HTML safely
    const bodyText = await response.text();

    // If Mapbox (or some proxy) sends HTML, fall back to OpenStreetMap
    if (!contentType.includes("application/json")) {
      console.warn(
        "Mapbox geocode response is not JSON. Body preview:\n",
        bodyText.slice(0, 500)
      );
      console.log("Falling back to OpenStreetMap...");
      
      // Fallback to OpenStreetMap
      const osmResult = await geocodeWithOpenStreetMap(text);
      if (osmResult) {
        return res.json(osmResult);
      }
      
      return res.json({ 
        error: "Invalid response from geocoding service. Your Mapbox API key may be invalid or expired.",
        details: bodyText.slice(0, 200),
        suggestion: "Check your Mapbox API key or the service will use OpenStreetMap as fallback"
      });
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (parseErr) {
      console.error(
        "Failed to parse Mapbox JSON:",
        parseErr,
        "\nBody preview:\n",
        bodyText.slice(0, 500)
      );
      return res.json({ 
        error: "Failed to parse geocoding response",
        details: bodyText.slice(0, 200)
      });
    }

    // Check for Mapbox API errors
    if (data.message) {
      console.error("Mapbox API error:", data.message);
      return res.json({ 
        error: data.message || "Geocoding service error"
      });
    }

    if (!data.features || data.features.length === 0) {
      console.log(`No results found for: "${text}"`);
      return res.json({ 
        error: "No location found. Try a more specific address or city name.",
        query: text
      });
    }

    const first = data.features[0];
    
    // Check if center exists
    if (!first.center || first.center.length < 2) {
      console.error("Invalid center data:", first);
      return res.json({ 
        error: "Invalid location data returned"
      });
    }

    // Mapbox center: [lng, lat]
    const [lng, lat] = first.center;

    console.log(`Geocoded "${text}" to: ${lat}, ${lng}`);
    return res.json({ lat, lng, place_name: first.place_name || text });
  } catch (err) {
    console.error("Mapbox geocode failed:", err);
    return res.json({ 
      error: "Geocoding service unavailable. Please try again later.",
      details: err.message
    });
  }
});
// ======================
// Log Bird POST route
// ======================
app.post("/log-bird", upload.single("photo"), async (req, res) => {
  try {
    const { bird, location, time, description, latitude, longitude } = req.body;
    const userId = req.session.user.id;

    //  Photo is REQUIRED
    if (!req.file) {
      return res.status(400).send("A bird photo is required.");
    }

    const photoPath = `/uploads/${req.file.filename}`;

    //  Convert empty strings → null for optional fields
    const safeLocation = location && location.trim() !== "" ? location : null;
    const safeTime = time && time.trim() !== "" ? time : null;
    const safeDescription = description && description.trim() !== "" ? description : null;

    //  lat/lng must be numbers or null
    const safeLat = latitude && latitude.trim() !== "" ? parseFloat(latitude) : null;
    const safeLng = longitude && longitude.trim() !== "" ? parseFloat(longitude) : null;

    await pool.query(
      `INSERT INTO bird_sightings 
        (user_id, bird, location, time, description, latitude, longitude, photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        userId,
        bird,
        safeLocation,
        safeTime,
        safeDescription,
        safeLat,
        safeLng,
        photoPath
      ]
    );

    res.redirect("/profile");

  } catch (err) {
    console.error("Error logging bird:", err);
    res.status(500).send("Error logging bird.");
  }
});



app.post("/api/ai-identify-bird", isAuthenticated, async (req, res) => {
  try {
    const { color, size, beak, location } = req.body;

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are an expert ornithologist. Based ONLY on the following inputs:

Color: ${color || "unknown"}
Size: ${size || "unknown"}
Beak Type: ${beak || "unknown"}
Location (optional): ${location || "unknown"}

Return A 10-15 of likely bird species found in North America that matches these traits, and that it is a bird found from eBird by the Cornell Lab of Ornithology API.
Return ONLY the bird species common name—no explanation, each bird seperated by a ',', no extra text.
Example output: "American Robin, Eagle, Cardinal"
    `;

    const result = await model.generateContent(prompt);
    const name = result.response.text().trim();

    res.json({ bird: name });

  } catch (err) {
    console.error("Gemini bird identify error:", err);
    res.status(500).json({ error: "AI identification failed" });
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
// REPLACE your existing /signup and /login routes with these improved versions:

// Signup POST - with proper error handling
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).render("signup", {
        title: "Sign Up",
        hideNavbar: true,
        error: "All fields are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).render("signup", {
        title: "Sign Up",
        hideNavbar: true,
        error: "Password must be at least 6 characters long"
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).render("signup", {
        title: "Sign Up",
        hideNavbar: true,
        error: "An account with this email already exists. Please log in instead."
      });
    }

    // Create new user
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashed]
    );

    // Redirect to login with success message
    res.render("login", {
      title: "Log In",
      hideNavbar: true,
      success: "Account created successfully! Please log in."
    });

  } catch (err) {
    console.error("Signup error:", err);
    
    // Check for specific database errors
    if (err.code === '23505') { // Unique violation
      return res.status(400).render("signup", {
        title: "Sign Up",
        hideNavbar: true,
        error: "An account with this email already exists."
      });
    }

    res.status(500).render("signup", {
      title: "Sign Up",
      hideNavbar: true,
      error: "Server error. Please try again later."
    });
  }
});

// Login POST - with proper error handling
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).render("login", {
        title: "Log In",
        hideNavbar: true,
        error: "Email and password are required"
      });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)', 
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).render("login", {
        title: "Log In",
        hideNavbar: true,
        error: "No account found with this email. Please sign up first."
      });
    }

    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).render("login", {
        title: "Log In",
        hideNavbar: true,
        error: "Incorrect password. Please try again."
      });
    }

    // Success - create session
    req.session.user = { 
      id: user.id, 
      name: user.name, 
      email: user.email,
      created_at: user.created_at,
      profile_picture: user.profile_picture || "/images/default_pfp.png",
      bio: user.bio
    };

    res.redirect('/home');

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render("login", {
      title: "Log In",
      hideNavbar: true,
      error: "Server error. Please try again later."
    });
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// TEMPORARY FRIEND POSTS (remove after friend system works)
const fakeFriendPosts = [
  {
    user: "Fake Friend 1",
    species: "Northern Cardinal",
    location: "Denver, CO",
    sighting_date: "2025-01-10",
    notes: "Saw it near the river.",
    photo: "/images/demo1.jpg"
  },
  {
    user: "Fake Friend 2",
    species: "Blue Jay",
    location: "Boulder, CO",
    sighting_date: "2025-01-12",
    notes: "Very loud!",
    photo: "/images/demo2.jpg"
  },
  {
    user: "Fake Friend 3",
    species: "Red-Tailed Hawk",
    location: "Golden, CO",
    sighting_date: "2025-01-14",
    notes: "Huge wingspan.",
    photo: "/images/demo3.jpg"
  }
];

// Protected pages
// REPLACE your existing /home route with this:
app.get("/home", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // 1) ALL posts (global feed) - show recent posts from all users
    const allResult = await pool.query(
      `SELECT 
         bs.id,
         bs.bird AS species,
         bs.location,
         to_char(bs.time, 'Mon DD, YYYY HH12:MI AM') as sighting_date,
         bs.description as notes,
         bs.photo,
         bs.created_at,
         bs.user_id,
         u.name as user_name,
         u.profile_picture as user_profile_picture
       FROM bird_sightings bs
       JOIN users u ON bs.user_id = u.id
       ORDER BY bs.created_at DESC
       LIMIT 200`
    );

    const allLogs = allResult.rows.map(row => ({
      id: row.id,
      species: row.species,
      location: row.location || "Unknown location",
      sighting_date: row.sighting_date || new Date(row.created_at).toLocaleString(),
      notes: row.notes || "",
      photo: row.photo || "/images/default_bird.png",
      user: row.user_name,
      user_id: row.user_id,
      profile_picture: row.user_profile_picture || "/images/default_pfp.png"
    }));

    // 2) FRIEND posts - find accepted friendships, then posts from those friend IDs
    const friendsRes = await pool.query(
      `SELECT 
         CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END AS friend_id
       FROM friendships f
       WHERE (f.requester_id = $1 OR f.receiver_id = $1)
         AND f.status = 'accepted'`,
      [userId]
    );

    let friendLogs = [];
    if (friendsRes.rows.length > 0) {
      const friendIds = friendsRes.rows.map(r => r.friend_id);
      // Build placeholders for parameterized IN clause
      const placeholders = friendIds.map((_, i) => `$${i + 1}`).join(",");
      const friendPostsQuery = `
        SELECT
          bs.id,
          bs.bird AS species,
          bs.location,
          to_char(bs.time, 'Mon DD, YYYY HH12:MI AM') as sighting_date,
          bs.description as notes,
          bs.photo,
          bs.created_at,
          bs.user_id,
          u.name as user_name,
          u.profile_picture as user_profile_picture
        FROM bird_sightings bs
        JOIN users u ON bs.user_id = u.id
        WHERE bs.user_id IN (${placeholders})
        ORDER BY bs.created_at DESC
        LIMIT 200
      `;
      const friendPostsResult = await pool.query(friendPostsQuery, friendIds);

      friendLogs = friendPostsResult.rows.map(row => ({
        id: row.id,
        species: row.species,
        location: row.location || "Unknown location",
        sighting_date: row.sighting_date || new Date(row.created_at).toLocaleString(),
        notes: row.notes || "",
        photo: row.photo || "/images/default_bird.png",
        user: row.user_name,
        user_id: row.user_id,
        profile_picture: row.user_profile_picture || "/images/default_pfp.png"
      }));
    }

    // Render template with both feeds
    res.render("home", { title: "Home", allLogs, friendLogs, currentUserId: userId });
  } catch (err) {
    console.error("Error loading home feed:", err);
    res.status(500).send("Error loading home feed");
  }
});
app.get("/log-bird", isAuthenticated, (req, res) => {
  res.render("log-bird", { title: "Log Bird" });
});

app.get("/map", isAuthenticated, (req, res) => {
  res.render("map", { title: "Map" });
});

// API endpoint to fetch all bird sightings with coordinates for the map
app.get("/api/bird-sightings/map", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const result = await pool.query(
      `SELECT 
        bs.id,
        bs.bird,
        bs.location,
        bs.latitude,
        bs.longitude,
        bs.photo,
        bs.description,
        bs.created_at,
        bs.user_id,
        u.name as user_name,
        u.email as user_email,
        u.profile_picture as user_profile_picture
       FROM bird_sightings bs
       JOIN users u ON bs.user_id = u.id
       WHERE bs.latitude IS NOT NULL 
         AND bs.longitude IS NOT NULL
       ORDER BY bs.created_at DESC`
    );
    
    // Check friendship status for each sighting
    const sightingsWithFriendship = await Promise.all(
      result.rows.map(async (sighting) => {
        // Skip friendship check if it's the current user's own post
        if (sighting.user_id === currentUserId) {
          return { ...sighting, is_friend: null, is_self: true };
        }
        
        // Check if already friends
        const friendshipCheck = await pool.query(
          `SELECT status FROM friendships 
           WHERE ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))
             AND status = 'accepted'`,
          [currentUserId, sighting.user_id]
        );
        
        const isFriend = friendshipCheck.rows.length > 0;
        
        // Check if there's a pending request
        const pendingCheck = await pool.query(
          `SELECT status FROM friendships 
           WHERE ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))
             AND status = 'pending'`,
          [currentUserId, sighting.user_id]
        );
        
        const hasPendingRequest = pendingCheck.rows.length > 0;
        
        return {
          ...sighting,
          is_friend: isFriend,
          has_pending_request: hasPendingRequest,
          is_self: false
        };
      })
    );
    
    res.json({
      success: true,
      sightings: sightingsWithFriendship
    });
  } catch (err) {
    console.error("Error fetching sightings for map:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching bird sightings",
      sightings: []
    });
  }
});

// Get comments page for a specific bird sighting
app.get("/comments/:sightingId", isAuthenticated, async (req, res) => {
  try {
    const sightingId = req.params.sightingId;
    
    // Fetch the bird sighting details
    const sightingResult = await pool.query(
      `SELECT bs.*, u.name as user_name, u.profile_picture as user_profile_picture
       FROM bird_sightings bs
       JOIN users u ON bs.user_id = u.id
       WHERE bs.id = $1`,
      [sightingId]
    );
    
    if (sightingResult.rows.length === 0) {
      return res.status(404).send("Bird sighting not found");
    }
    
    const sighting = sightingResult.rows[0];
    
    // Fetch comments for this sighting
    // Handle case where comments table might not exist yet
    let comments = [];
    try {
      const commentsResult = await pool.query(
        `SELECT c.*, u.name as user_name, u.profile_picture as user_profile_picture
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.sighting_id = $1
         ORDER BY c.created_at ASC`,
        [sightingId]
      );
      comments = commentsResult.rows;
    } catch (commentsErr) {
      // If comments table doesn't exist, just use empty array
      console.warn("Comments table may not exist yet:", commentsErr.message);
      comments = [];
    }
    
    res.render("comment", {
      title: "Comments",
      sighting: sighting,
      comments: comments
    });
  } catch (err) {
    console.error("Error loading comments page:", err);
    res.status(500).send("Error loading comments: " + err.message);
  }
});

// Old /comments route - redirect to home if no sighting ID provided
app.get("/comments", isAuthenticated, (req, res) => {
  res.redirect("/home");
});

app.get("/friends", isAuthenticated, (req, res) => {
  res.render("friends", { 
    title: "Friends",
    user: req.session.user
  });
});

app.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;

    // Default profile picture if none stored
    if (!user.profile_picture) {
      user.profile_picture = "/images/default_pfp.png";
    }

    // Format created_at nicely
    let formattedDate = "";
    if (user.created_at) {
      const date = new Date(user.created_at);
      formattedDate = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // 🔥 Fetch posts by this user
    const postsResult = await pool.query(
      "SELECT * FROM bird_sightings WHERE user_id = $1 ORDER BY created_at DESC",
      [user.id]
    );

    const posts = postsResult.rows;

    res.render("profile", {
      title: "Profile",
      user: { ...user, formatted_date: formattedDate },
      posts
    });

  } catch (err) {
    console.error("Error loading profile:", err);
    res.status(500).send("Error loading profile");
  }
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
    
    // Check if friendship already exists (in either direction)
    const existingFriendship = await pool.query(
      `SELECT * FROM friendships 
       WHERE (requester_id = $1 AND receiver_id = $2) 
          OR (requester_id = $2 AND receiver_id = $1)`,
      [senderId, recipient.id]
    );
    
    if (existingFriendship.rows.length > 0) {
      const friendship = existingFriendship.rows[0];
      if (friendship.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: "You are already friends with this user"
        });
      } else if (friendship.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: "Friend request already exists"
        });
      }
    }
    
    // Create the friendship request
    const newFriendship = await pool.query(
      `INSERT INTO friendships (requester_id, receiver_id, status) 
       VALUES ($1, $2, 'pending') 
       RETURNING *`,
      [senderId, recipient.id]
    );
    
    res.json({
      success: true,
      message: `Friend request sent to ${recipient.name}`,
      request: {
        id: newFriendship.rows[0].id,
        senderId: senderId,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        status: 'pending',
        timestamp: newFriendship.rows[0].created_at
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
app.get("/api/friends/requests/incoming", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    console.log("Checking incoming requests for user ID:", userId);
    
    const result = await pool.query(
      `SELECT f.*, u.name as requester_name, u.email as requester_email, u.profile_picture as requester_profile_picture
       FROM friendships f
       JOIN users u ON f.requester_id = u.id
       WHERE f.receiver_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    
    console.log("Query returned:", result.rows.length, "requests");
    console.log("Requests:", result.rows);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching incoming friend requests:", err);
    res.status(500).json({ 
      success: false, 
      message: "Unable to fetch friend requests" 
    });
  }
});

// Accept a friend request
app.post("/api/friends/accept/:requestId", isAuthenticated, async (req, res) => {
  try {
    const requestId = req.params.requestId;
    const userId = req.session.user.id;
    
    // Verify this request is for the current user and is pending
    const result = await pool.query(
      `UPDATE friendships 
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Friend request not found or already processed"
      });
    }
    
    res.json({
      success: true,
      message: "Friend request accepted!",
      friendship: result.rows[0]
    });
  } catch (err) {
    console.error("Error accepting friend request:", err);
    res.status(500).json({ 
      success: false, 
      message: "Unable to accept friend request" 
    });
  }
});

// Decline a friend request
app.post("/api/friends/decline/:requestId", isAuthenticated, async (req, res) => {
  try {
    const requestId = req.params.requestId;
    const userId = req.session.user.id;
    
    // Verify this request is for the current user and is pending
    const result = await pool.query(
      `UPDATE friendships 
       SET status = 'declined', updated_at = NOW()
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Friend request not found or already processed"
      });
    }
    
    res.json({
      success: true,
      message: "Friend request declined",
      friendship: result.rows[0]
    });
  } catch (err) {
    console.error("Error declining friend request:", err);
    res.status(500).json({ 
      success: false, 
      message: "Unable to decline friend request" 
    });
  }
});

// Get list of friends for current user
app.get("/api/friends", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const result = await pool.query(
      `SELECT 
         u.id, u.name, u.email, u.profile_picture, u.bio, u.created_at,
         f.created_at as friendship_date,
         CASE WHEN fav.id IS NOT NULL THEN true ELSE false END as isFavorite
       FROM friendships f
       JOIN users u ON (
         CASE 
           WHEN f.requester_id = $1 THEN u.id = f.receiver_id
           ELSE u.id = f.requester_id
         END
       )
       LEFT JOIN favorites fav ON fav.user_id = $1 AND fav.friend_id = u.id
       WHERE (f.requester_id = $1 OR f.receiver_id = $1) 
         AND f.status = 'accepted'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching friends:", err);
    res.status(500).json({ 
      success: false, 
      message: "Unable to fetch friends list" 
    });
  }
});

// Remove a friend
app.delete("/api/friends/:friendId", isAuthenticated, async (req, res) => {
  try {
    const friendId = req.params.friendId;
    const userId = req.session.user.id;
    
    // Delete friendship in either direction
    const result = await pool.query(
      `DELETE FROM friendships 
       WHERE ((requester_id = $1 AND receiver_id = $2) 
              OR (requester_id = $2 AND receiver_id = $1))
         AND status = 'accepted'
       RETURNING *`,
      [userId, friendId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Friendship not found"
      });
    }
    
    // Also remove from favorites if favorited
    await pool.query(
      `DELETE FROM favorites WHERE user_id = $1 AND friend_id = $2`,
      [userId, friendId]
    );
    
    res.json({
      success: true,
      message: "Friend removed successfully"
    });
  } catch (err) {
    console.error("Error removing friend:", err);
    res.status(500).json({ 
      success: false, 
      message: "Unable to remove friend" 
    });
  }
});

// Add friend to favorites
app.post("/api/friends/:friendId/favorite", isAuthenticated, async (req, res) => {
  try {
    const friendId = req.params.friendId;
    const userId = req.session.user.id;
    
    // Check if friendship exists
    const friendshipCheck = await pool.query(
      `SELECT 1 FROM friendships 
       WHERE ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))
         AND status = 'accepted'`,
      [userId, friendId]
    );
    
    if (friendshipCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "You can only favorite friends"
      });
    }
    
    // Add to favorites
    await pool.query(
      `INSERT INTO favorites (user_id, friend_id) VALUES ($1, $2)
       ON CONFLICT (user_id, friend_id) DO NOTHING`,
      [userId, friendId]
    );
    
    res.json({
      success: true,
      message: "Friend added to favorites"
    });
  } catch (err) {
    console.error("Error adding friend to favorites:", err);
    res.status(500).json({ 
      success: false, 
      message: "Unable to add friend to favorites" 
    });
  }
});

// Remove friend from favorites
app.delete("/api/friends/:friendId/favorite", isAuthenticated, async (req, res) => {
  try {
    const friendId = req.params.friendId;
    const userId = req.session.user.id;
    
    const result = await pool.query(
      `DELETE FROM favorites WHERE user_id = $1 AND friend_id = $2 RETURNING *`,
      [userId, friendId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Friend not in favorites"
      });
    }
    
    res.json({
      success: true,
      message: "Friend removed from favorites"
    });
  } catch (err) {
    console.error("Error removing friend from favorites:", err);
    res.status(500).json({ 
      success: false, 
      message: "Unable to remove friend from favorites" 
    });
  }
});

// ======================
// Comment API Routes
// ======================

// POST route to submit a comment
app.post("/api/comments", isAuthenticated, async (req, res) => {
  try {
    const { sighting_id, comment_text } = req.body;
    const userId = req.session.user.id;
    
    if (!sighting_id || !comment_text || comment_text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Sighting ID and comment text are required"
      });
    }
    
    // Verify the sighting exists
    const sightingCheck = await pool.query(
      "SELECT id FROM bird_sightings WHERE id = $1",
      [sighting_id]
    );
    
    if (sightingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bird sighting not found"
      });
    }
    
    // Insert the comment
    const result = await pool.query(
      `INSERT INTO comments (sighting_id, user_id, comment_text)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [sighting_id, userId, comment_text.trim()]
    );
    
    // Fetch the comment with user info for response
    const commentResult = await pool.query(
      `SELECT c.*, u.name as user_name, u.profile_picture as user_profile_picture
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [result.rows[0].id]
    );
    
    res.json({
      success: true,
      message: "Comment posted successfully",
      comment: commentResult.rows[0]
    });
  } catch (err) {
    console.error("Error posting comment:", err);
    // Check if the error is because the table doesn't exist
    if (err.message && err.message.includes('does not exist')) {
      return res.status(500).json({
        success: false,
        message: "Comments table not found. Please run the database migration to create the comments table."
      });
    }
    res.status(500).json({
      success: false,
      message: "Error posting comment: " + err.message
    });
  }
});

// GET route to fetch comments for a sighting (API endpoint)
app.get("/api/comments/:sightingId", isAuthenticated, async (req, res) => {
  try {
    const sightingId = req.params.sightingId;
    
    const result = await pool.query(
      `SELECT c.*, u.name as user_name, u.profile_picture as user_profile_picture
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.sighting_id = $1
       ORDER BY c.created_at ASC`,
      [sightingId]
    );
    
    res.json({
      success: true,
      comments: result.rows
    });
  } catch (err) {
    console.error("Error fetching comments:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching comments"
    });
  }
});

// Always return the full species list (survey filters still work)
app.get("/api/bird-suggestions", isAuthenticated, async (req, res) => {
  try {
    const response = await fetch(
      "https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json",
      { headers: { "X-eBirdApiToken": EBIRD_API_KEY } }
    );

    const species = await response.json();

    const cleaned = species.map(s => ({
      comName: s.comName,
      sciName: s.sciName || "",
    }));

    res.json(cleaned);

  } catch (err) {
    console.error("Bird API error:", err);
    res.status(500).json({ error: "Failed to fetch species" });
  }
});

// Get bird posts for a specific user
app.get("/api/users/:userId/posts", isAuthenticated, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if the requested user is a friend
    const currentUserId = req.session.user.id;
    const friendshipCheck = await pool.query(
      `SELECT 1 FROM friendships 
       WHERE ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))
         AND status = 'accepted'`,
      [currentUserId, userId]
    );
    
    if (friendshipCheck.rows.length === 0 && currentUserId != userId) {
      return res.status(403).json({
        success: false,
        message: "You can only view posts of your friends"
      });
    }
    
    const result = await pool.query(
      `SELECT 
        bs.id,
        bs.bird as species,
        bs.location,
        bs.time as sighting_date,
        to_char(bs.time, 'Mon DD, YYYY HH12:MI AM') as sighting_date_formatted,
        bs.description as notes,
        bs.photo,
        bs.created_at,
        bs.user_id,
        u.name as user_name,
        u.profile_picture
       FROM bird_sightings bs
       JOIN users u ON bs.user_id = u.id
       WHERE bs.user_id = $1
       ORDER BY bs.created_at DESC`,
      [userId]
    );
    
    // Map to expected format
    const posts = result.rows.map(row => ({
      id: row.id,
      species: row.species,
      location: row.location || "Unknown location",
      sighting_date: row.sighting_date_formatted || new Date(row.created_at).toLocaleString(),
      sighting_date_at: row.sighting_date || row.created_at,
      notes: row.notes || "",
      photo: row.photo || "/images/default_bird.png",
      user_id: row.user_id,
      user_name: row.user_name,
      profile_picture: row.profile_picture
    }));
    
    res.json(posts);
  } catch (err) {
    console.error('Error fetching user posts:', err);
    res.status(500).json({
      success: false,
      message: "Error fetching user posts"
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unexpected error:', err)
  res.status(500).send('Something went wrong. Please try again later.')
})

// Start server
app.listen(PORT, () => console.log(`Bird Brain running on http://localhost:${PORT}`));

// merge main 