const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Set up Handlebars engine
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
app.use((req, res, next) => {
  res.locals.year = new Date().getFullYear();
  next();
});
// Routes
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login", { title: "Log In" });
});

app.get("/signup", (req, res) => {
  res.render("signup", { title: "Sign Up" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt:", email, password);
  res.redirect("/"); // placeholder
});

app.post("/signup", (req, res) => {
  const { name, email, password } = req.body;
  console.log("New user:", name, email);
  res.redirect("/login");
});

// Start server
app.listen(PORT, () => console.log(`Bird Brain running on http://localhost:${PORT}`));