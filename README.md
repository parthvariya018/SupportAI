# SupportAI — AI Customer Support SaaS

Multi-tenant SaaS platform where companies train a chatbot on their PDFs and embed it on their website.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS + Zustand
- **Backend**: Node.js + Express.js
- **Database**: MongoDB Atlas
- **AI**: Google Gemini 1.5 Flash (free tier)
- **PDF**: pdf-parse

---

## Quick Start

### 1. Server

```bash
cd server
npm install
# Edit .env with your MongoDB URI and Gemini API key
npm run dev
```

### 2. Client

```bash
cd client
npm install
npm run dev
```

---

## Environment Variables (server/.env)

```
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_key
CLIENT_URL=http://localhost:5173
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | — | Create company + admin |
| POST | /api/auth/login | — | Login, get JWT |
| GET | /api/auth/me | JWT | Get current user |
| GET | /api/dashboard/stats | JWT | Dashboard metrics |
| POST | /api/documents/upload | JWT | Upload + parse PDF |
| GET | /api/documents | JWT | List documents |
| DELETE | /api/documents/:id | JWT | Delete document |
| POST | /api/chat/message | API Key | Send chat message |
| GET | /api/chat/history | JWT | List conversations |
| GET | /api/chat/history/:id | JWT | Single conversation |
| POST | /api/leads | API Key | Capture lead from widget |
| GET | /api/leads | JWT | List leads |
| PATCH | /api/settings/profile | JWT | Update profile |
| PATCH | /api/settings/password | JWT | Change password |

---

## Embedding the Widget

```html
<script>
  window.SUPPORTAI_KEY = "your_company_api_key";
</script>
<script src="https://your-domain.com/widget.js"></script>
```

Or import the React component directly:

```jsx
import ChatWidget from './components/ChatWidget';
<ChatWidget apiKey="your_company_api_key" primaryColor="#2563eb" />
```

---

## Production Deployment

### Docker (recommended)

**Prerequisites:** Docker Desktop or Docker Engine + Docker Compose v2.

```bash
# 1. Copy and fill in your secrets
cp server/.env.example server/.env
# Edit server/.env — set MONGO_URI, JWT_SECRET, GEMINI_API_KEY, STRIPE_*, etc.

# 2. Build images
docker compose build

# 3. Start all services
docker compose up -d

# 4. Verify
curl http://localhost:5000/health   # → {"status":"ok",...}
curl http://localhost:5000/ready    # → {"status":"ready","db":"connected"}

# 5. View logs
docker compose logs -f

# 6. Stop
docker compose down
```

The frontend is served at **http://localhost:80** and the API at **http://localhost:5000**.
nginx proxies `/api/*` and `/socket.io/*` to the server container internally.

### PM2 (bare-metal / VPS)

```bash
npm install -g pm2

cd server
npm install --omit=dev

# Start with production env
pm2 start ecosystem.config.js --env prod

# Persist across reboots
pm2 save
pm2 startup

# Zero-downtime reload after code update
pm2 reload ecosystem.config.js
```

### Environment Variables

All secrets are loaded from `server/.env` at runtime — they are **never baked into the Docker image**.
See `server/.env.example` for the full list of variables.

Key variables required for production:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | ≥ 32 random chars (`openssl rand -hex 32`) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `CLIENT_URL` | Your frontend URL (CORS) |
| `SMTP_HOST/USER/PASS` | SMTP credentials for email |

### Health & Readiness Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness — process is running |
| `GET /ready` | Readiness — DB is connected |
| `GET /metrics` | Process metrics (JWT required) |

---

## Architecture

```
Client (React)          Server (Express)         MongoDB
─────────────           ────────────────         ───────
Login/Register  ──────▶ POST /auth/*      ──────▶ Company, User
Dashboard       ──────▶ GET  /dashboard   ──────▶ Conversation, Lead, Document
Training        ──────▶ POST /documents   ──────▶ Document (extractedText)
Conversations   ──────▶ GET  /chat        ──────▶ Conversation.messages
Leads           ──────▶ GET  /leads       ──────▶ Lead
Settings        ──────▶ PATCH /settings   ──────▶ User, Company

Widget (public) ──────▶ POST /chat/message ─────▶ Gemini API → reply
                ──────▶ POST /leads         ─────▶ Lead capture
```
