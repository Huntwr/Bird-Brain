# Bird-Brain
Bird Brain is a social bird tracking application that allows users to identify and log bird sightings from anywhere. Users can upload photos, add descriptions, and record the exact location of birds they encounter. The application displays user and community sightings on an interactive map, letting outdoor enthusiasts and casual members explore discoveries made by friends in real time.

Audience: The target audience is for people who love birds and the outdoors (bird watchers).

Vision Statement: For bird enthusiasts and outdoor explorers who want to discover, identify, and share bird sightings in their environment, Bird Brain is an interactive social application that enables logging, identifying, and exploring birds on a map in real time. Users can upload sightings, view friends' activity, and collaborate in a shared birding community.

## Contributors
| Name | Email | GitHub |
|-----|-------|--------|
| Aaron Duong | aadu7536@colorado.edu | Aaronduo7536 |
| Koa Lister | pali8174@colorado.edu | koalister |
| Vinnie De Lisi | vide1065@colorado.edu | VinnieDeLisi |
| Jackson Gothie | jago6572@colorado.edu | jackg22 |
| Hunter Irish | huir2366@colorado.edu | Huntwr |

## Technology Stack
| Layer | Technology |
|------|------------|
Frontend | Handlebars, HTML/CSS/JavaScript  
Backend | Node.js with Express  
Database | PostgreSQL  
Mapping API | Mapbox API  
Additional APIs | eBird API, Google Gemini API  
Containerization | Docker and Docker Compose  
Version Control | GitHub  
Testing | Mocha and Chai  
Deployment | Render  

---

## Prerequisites to run the application:

- **Docker Desktop installed**  
  The application runs inside Docker containers. You must be able to run `docker compose` commands.

- **Git installed**  
  Used to clone the repository.

No other local dependencies are required as Node.js and PostgreSQL are handled within Docker.

---

## Instructions on how to run the application locally with Docker:

1. **Clone the repository**
2. **cd ProjectSourceCode**
3. **docker compose up**
4. **Visit http://localhost:3000**

---

## How to Run Tests in Docker:

1. **cd ProjectSourceCode**
2. **docker compose up --build**
3. **docker compose exec web npm test**

---

## Link to the deployed application:
https://bird-brain-1.onrender.com/

## Link to demo video:
https://drive.google.com/file/d/1rOAa922UfnyuVtoYGObPd4R_10GYPgpS/view?usp=sharing 
