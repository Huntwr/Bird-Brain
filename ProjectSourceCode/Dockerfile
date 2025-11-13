FROM node:lts

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install express express-handlebars pg bcryptjs express-session dotenv multer

COPY . .

EXPOSE 3000

CMD ["npm", "start"]