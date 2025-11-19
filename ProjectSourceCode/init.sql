DROP TABLE IF EXISTS bird_sightings;

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
