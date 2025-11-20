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

-- BIRD SIGHTINGS TABLE
CREATE TABLE bird_sightings (
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
