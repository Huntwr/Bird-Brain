DROP TABLE IF EXISTS bird_sightings;
DROP TABLE IF EXISTS users;

-- USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    profile_picture VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bird_logs (
  id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    bird VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    time TIMESTAMP,
    description TEXT,
    latitude FLOAT,
    longitude FLOAT,
    photo VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Friends/Friendship table to handle friend relationships
CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  requester_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(requester_id, receiver_id),
  CHECK (requester_id != receiver_id)
);
