const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcryptjs = require('bcryptjs');
const pgp = require('pg-promise')();

const app = express();

// ==================== DATABASE CONNECTION ====================
const db = pgp({
  host: 'db', // matches service name in docker-compose.yaml
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

// ==================== MIDDLEWARE ====================
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'super duper secret!',
    resave: false,
    saveUninitialized: true,
  })
);


app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || username.trim() === '' || password.trim() === '') {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    const hashed = await bcryptjs.hash(password, 10);

    await db.none('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashed]);

    res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('Register error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/test', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.status(200).send('<html><body><h1>Login Page</h1></body></html>');
});

module.exports = app.listen(3000, () => {
  console.log('Server running on port 3000');
});
