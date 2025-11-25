-- Migration script to add comments table
-- Run this if your database already exists and you need to add the comments table

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  sighting_id INTEGER NOT NULL REFERENCES bird_sightings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

