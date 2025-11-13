CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  profile_picture VARCHAR(255),
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS bird_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  species VARCHAR(100),
  location VARCHAR(255),
  sighting_date TIMESTAMP,
  notes VARCHAR(500),
  sighting_date_at TIMESTAMP DEFAULT NOW()
);