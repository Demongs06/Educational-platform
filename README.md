# LearnHub — Learning Management System

A full-stack LMS with student and administrator accounts, course publishing, enrollment and lesson progress.

## Stack
- React + Vite
- Express + MongoDB Atlas (Mongoose)
- JWT in HttpOnly cookies, bcrypt password hashing
- Netlify (client) + Render (server)

## Local setup

### 1. API
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
Set `MONGODB_URI`, a long random `JWT_SECRET`, `ADMIN_SETUP_KEY`, and `CLIENT_URL=http://localhost:5173` in `.env`.

### 2. Create the first administrator
Start the API, then call this once with your own values and the setup key:
```bash
curl -X POST http://localhost:5000/api/admin/setup \
  -H "Content-Type: application/json" \
  -H "x-admin-setup-key: YOUR_ADMIN_SETUP_KEY" \
  -d '{"name":"Site Admin","email":"admin@example.com","password":"Use-A-Strong-Password"}'
```
This endpoint only works while no admin exists. Keep the setup key private.

### 3. Frontend
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Set `VITE_API_URL=http://localhost:5000/api`.

## Deploy

**Render API:** create a Web Service from this repository, root directory `server`, build command `npm install`, start command `npm start`. Add `MONGODB_URI`, `JWT_SECRET`, `ADMIN_SETUP_KEY`, `CLIENT_URL` (your Netlify URL), and `NODE_ENV=production`.

**Netlify frontend:** import this repository, base directory `client`, build command `npm run build`, publish directory `dist`. Add `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api`.

After deployment, call the admin setup endpoint once using the Render URL and the configured setup key. Free Render instances may sleep when idle.

## Security notes
- Public registration always creates student accounts; admin roles cannot be self-selected.
- Passwords are hashed and sessions use HttpOnly cookies.
- Configure exact frontend origin in `CLIENT_URL`; do not use wildcard CORS with credentials.
- Never commit real environment files or secrets.
