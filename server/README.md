# SupportAI Backend — Production-Ready Node.js API

Multi-tenant AI Customer Support SaaS backend with authentication, RBAC, Stripe billing, real-time chat, and AI-powered responses.

---

## Features

✅ **Authentication & Authorization**
- JWT-based authentication with refresh token support
- Password reset via email token
- Invite-based team member onboarding

✅ **Multi-Tenancy**
- Company-scoped data isolation
- API key authentication for widget
- Per-tenant usage tracking

✅ **Role-Based Access Control (RBAC)**
- 4 roles: `owner`, `admin`, `agent`, `viewer`
- Granular permissions: `tickets:write`, `kb:delete`, `billing:read`, etc.
- Permission matrix in `middleware/rbac.js`

✅ **Ticket Management**
- Full CRUD with status, priority, assignment
- Internal notes + timeline tracking
- Real-time updates via Socket.io

✅ **Knowledge Base**
- PDF upload + parsing with `pdf-parse`
- Article CRUD with categories, tags, voting
- Full-text search on documents

✅ **AI Chat System**
- Gemini 2.5 Flash integration
- Context-aware retrieval with TF-IDF scoring
- Conversation history + source citations

✅ **Team Management**
- Member invites with role assignment
- Team groups with auto-assign
- Presence tracking via Socket.io

✅ **Analytics Dashboard**
- Conversation, ticket, lead metrics
- Agent performance stats (resolution time, load)
- CSAT tracking + volume time-series

✅ **Stripe Billing**
- Checkout sessions for subscription plans
- Webhook handling (subscription lifecycle)
- Billing portal + invoice retrieval

✅ **Real-time Features (Socket.io)**
- Typing indicators
- Agent presence (online/offline)
- Live ticket updates
- Chat handoff (bot → human)

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB 7+ (Mongoose ODM)
- **AI**: Google Gemini 1.5 Flash
- **Payments**: Stripe
- **Real-time**: Socket.io
- **Auth**: JWT + bcryptjs
- **File Upload**: Multer + pdf-parse

---

## Installation

```bash
cd server
npm install
```

### Environment Variables

Create `.env`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/supportai
JWT_SECRET=your_random_secret_key
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key
CLIENT_URL=http://localhost:5173

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_STARTER_MONTHLY=price_id_here
STRIPE_STARTER_YEARLY=price_id_here
STRIPE_PRO_MONTHLY=price_id_here
STRIPE_PRO_YEARLY=price_id_here
```

### Start Server

```bash
npm run dev    # nodemon (development)
npm start      # production
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create company + owner account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user profile |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password/:token` | Reset password with token |

**Example: Register**
```json
POST /api/auth/register
{
  "companyName": "Acme Corp",
  "name": "John Doe",
  "email": "john@acme.com",
  "password": "secure123"
}
```

**Response:**
```json
{
  "status": "success",
  "token": "jwt_token_here",
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@acme.com",
    "role": "owner",
    "company": { "id": "...", "name": "Acme Corp", "apiKey": "..." }
  }
}
```

---

### Tickets

**Requires:** JWT Auth  
**Permissions:** `tickets:read`, `tickets:write`, `tickets:delete`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List tickets (paginated, filterable) |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/:id` | Get single ticket |
| PATCH | `/api/tickets/:id` | Update ticket |
| DELETE | `/api/tickets/:id` | Delete ticket |
| POST | `/api/tickets/:id/notes` | Add note to ticket |

**Query Params (GET /api/tickets):**
- `status`: `open`, `in_progress`, `waiting`, `resolved`, `closed`
- `priority`: `low`, `medium`, `high`, `urgent`
- `assignedTo`: User ID
- `page`, `limit`: Pagination

**Example: Create Ticket**
```json
POST /api/tickets
Authorization: Bearer <jwt>
{
  "title": "Login not working",
  "description": "User cannot log in with correct credentials",
  "priority": "high",
  "reportedBy": { "name": "Customer", "email": "customer@example.com" }
}
```

---

### Chat (Widget API)

**Auth:** API Key (`x-api-key` header or `apiKey` query param)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/message` | Send message, get AI reply |
| GET | `/api/chat/history` | List conversations (JWT) |
| GET | `/api/chat/history/:id` | Get conversation (JWT) |
| DELETE | `/api/chat/history/:id` | Delete conversation (JWT) |
| PATCH | `/api/chat/history/:id` | Rename conversation (JWT) |

**Example: Chat Message**
```json
POST /api/chat/message
x-api-key: company_api_key
{
  "message": "How do I reset my password?",
  "sessionId": "optional_session_id"
}
```

**Response:**
```json
{
  "status": "success",
  "reply": "To reset your password, click 'Forgot Password' on the login page...",
  "sessionId": "abc123",
  "sources": [
    {
      "documentId": "...",
      "originalName": "user-guide.pdf",
      "snippet": "Password reset instructions..."
    }
  ]
}
```

---

### Knowledge Base

**Requires:** JWT Auth  
**Permissions:** `kb:read`, `kb:write`, `kb:delete`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge` | List articles |
| POST | `/api/knowledge` | Create article |
| GET | `/api/knowledge/:id` | Get article (increments views) |
| PATCH | `/api/knowledge/:id` | Update article |
| DELETE | `/api/knowledge/:id` | Delete article |
| POST | `/api/knowledge/:id/vote` | Vote helpful/not helpful |

**Documents (PDF Upload):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload PDF (multipart/form-data) |
| GET | `/api/documents` | List documents |
| DELETE | `/api/documents/:id` | Delete document |

---

### Team Management

**Requires:** JWT Auth  
**Permissions:** `team:read`, `team:write`, `team:delete`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/team` | List team members |
| POST | `/api/team/invite` | Invite new member (owner/admin only) |
| POST | `/api/team/invite/accept/:token` | Accept invite |
| PATCH | `/api/team/:id/role` | Update member role |
| DELETE | `/api/team/:id` | Remove member |

**Team Groups:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/team/groups` | List groups |
| POST | `/api/team/groups` | Create group |
| PATCH | `/api/team/groups/:id` | Update group |
| DELETE | `/api/team/groups/:id` | Delete group |

---

### Analytics

**Requires:** JWT Auth  
**Permissions:** `analytics:read`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview` | Overall stats + daily timeline |
| GET | `/api/analytics/conversations` | Conversation breakdown |
| GET | `/api/analytics/tickets` | Ticket stats + avg resolution time |
| GET | `/api/analytics/volume?days=30` | Chat/ticket volume over time |
| GET | `/api/analytics/agents` | Per-agent performance |
| GET | `/api/analytics/csat?days=30` | Customer satisfaction scores |
| GET | `/api/analytics/leads?days=30` | Lead funnel metrics |

---

### Billing (Stripe)

**Requires:** JWT Auth  
**Permissions:** `billing:read`, `billing:write` (owner/admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing/plans` | List available plans |
| GET | `/api/billing/subscription` | Current subscription status |
| POST | `/api/billing/subscribe` | Create Stripe Checkout session |
| POST | `/api/billing/portal` | Redirect to Stripe billing portal |
| POST | `/api/billing/cancel` | Cancel subscription at period end |
| GET | `/api/billing/invoices` | List past invoices |
| POST | `/api/billing/webhook` | Stripe webhook handler (raw body) |

**Example: Subscribe**
```json
POST /api/billing/subscribe
Authorization: Bearer <jwt>
{
  "planId": "pro",
  "interval": "monthly"
}
```

**Response:**
```json
{
  "status": "success",
  "url": "https://checkout.stripe.com/..."
}
```

---

### Settings

**Requires:** JWT Auth  
**Permissions:** `settings:read`, `settings:write`, `apikey:rotate`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get user + company settings |
| PATCH | `/api/settings/profile` | Update user profile |
| PATCH | `/api/settings/company` | Update company name (owner/admin) |
| PATCH | `/api/settings/password` | Change password |
| PATCH | `/api/settings/widget` | Update widget config (owner/admin) |
| GET | `/api/settings/api-key` | Get API key (owner only) |
| POST | `/api/settings/api-key/rotate` | Rotate API key (owner only) |

---

## Database Schema

### Company
```js
{
  _id, name, email, apiKey,
  plan: "free|starter|pro|enterprise",
  usage: { messagesThisMonth, documentsCount, usageResetAt },
  widgetConfig: { primaryColor, welcomeMessage, position, showLeadForm },
  stripeCustomerId, stripeSubscriptionId,
  createdAt, updatedAt
}
```

### User
```js
{
  _id, companyId,
  name, email, password (hashed),
  role: "owner|admin|agent|viewer",
  avatar, isActive, lastSeenAt,
  inviteToken, inviteExpires,
  passwordResetToken, passwordResetExpires,
  createdAt, updatedAt
}
```

### Ticket
```js
{
  _id, companyId,
  title, description,
  status: "open|in_progress|waiting|resolved|closed",
  priority: "low|medium|high|urgent",
  assignedTo, reportedBy: { name, email },
  conversationId,
  tags: [],
  notes: [{ content, author, isInternal, createdAt }],
  timeline: [{ action, performedBy, note, createdAt }],
  dueDate, resolvedAt, closedAt,
  createdAt, updatedAt
}
```

### Conversation
```js
{
  _id, companyId, sessionId,
  title, messages: [{ role, content, sources, timestamp }],
  messageCount, leadCaptured,
  satisfaction: { score, comment },
  createdAt, updatedAt
}
```

### Document
```js
{
  _id, companyId,
  originalName, extractedText,
  charCount, wordCount, pageCount,
  uploadedBy,
  createdAt, updatedAt
}
```

### Article (Knowledge Base)
```js
{
  _id, companyId,
  title, slug, content,
  category, tags,
  status: "draft|published",
  author, views, helpful, notHelpful,
  createdAt, updatedAt
}
```

### Team
```js
{
  _id, companyId,
  name, description,
  members: [userId],
  autoAssign: Boolean,
  createdBy,
  createdAt, updatedAt
}
```

### Lead
```js
{
  _id, companyId, conversationId,
  name, email, phone, message,
  createdAt, updatedAt
}
```

---

## RBAC Permission Matrix

| Role | Permissions |
|------|------------|
| **viewer** | `tickets:read`, `conversations:read`, `kb:read`, `analytics:read`, `leads:read`, `team:read` |
| **agent** | All viewer + `tickets:write`, `conversations:write` |
| **admin** | All agent + `tickets:delete`, `kb:write`, `kb:delete`, `leads:write`, `team:write`, `settings:write`, `billing:read` |
| **owner** | All admin + `team:delete`, `billing:write`, `apikey:rotate` |

---

## Real-time Events (Socket.io)

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join:company` | `companyId` | Join company room |
| `join:conversation` | `conversationId` | Join conversation room |
| `typing:start` | `{ conversationId }` | Notify typing started |
| `typing:stop` | `{ conversationId }` | Notify typing stopped |
| `chat:reply` | `{ conversationId, message }` | Agent sends reply |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `agent:online` | `{ userId, name }` | Agent connected |
| `agent:offline` | `{ userId }` | Agent disconnected |
| `ticket:new` | `ticket` | New ticket created |
| `ticket:updated` | `ticket` | Ticket updated |
| `typing:start` | `{ userId, name }` | Someone is typing |
| `typing:stop` | `{ userId }` | Typing stopped |
| `chat:message` | `{ role, content, agentName, timestamp }` | New message |

---

## Security Features

✅ **JWT Authentication** with 7-day expiry  
✅ **bcryptjs** password hashing (cost factor 12)  
✅ **Helmet.js** security headers  
✅ **CORS** with origin whitelist  
✅ **Rate limiting** (300 req/15min global, 30 req/min chat)  
✅ **Input validation** on all routes  
✅ **Multi-tenant isolation** via `companyId` scope  
✅ **Stripe webhook signature verification**  
✅ **Password reset token** hashed with SHA-256  
✅ **Invite tokens** with 48h expiry

---

## Deployment

### Production Checklist

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET` (32+ random chars)
3. Connect to MongoDB Atlas with `retryWrites=true&w=majority`
4. Enable Stripe webhooks: `stripe listen --forward-to localhost:5000/api/billing/webhook`
5. Set up SSL (Nginx + Let's Encrypt or AWS ALB)
6. Configure CORS `CLIENT_URL` to production domain
7. Enable MongoDB indexes: `db.tickets.createIndex({ companyId: 1, status: 1, createdAt: -1 })`
8. Set up PM2 for process management:
   ```bash
   pm2 start server.js -i max
   pm2 save
   pm2 startup
   ```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

---

## Testing

```bash
# Health check
curl http://localhost:5000/health

# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test","name":"Admin","email":"admin@test.com","password":"test123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test123"}'
```

---

## File Structure

```
server/
├── config/
│   ├── db.js                 # MongoDB connection
│   └── socket.js             # Socket.io setup + handlers
├── controllers/
│   ├── authController.js
│   ├── ticketController.js
│   ├── chatController.js
│   ├── teamController.js
│   ├── knowledgeController.js
│   ├── analyticsController.js
│   ├── billingController.js
│   ├── settingsController.js
│   ├── dashboardController.js
│   ├── documentController.js
│   └── leadController.js
├── middleware/
│   ├── auth.js               # JWT protect + restrictTo
│   ├── rbac.js               # Permission checks
│   ├── apiKey.js             # Widget API key auth
│   ├── planGuard.js          # Usage quota enforcement
│   ├── errorHandler.js
│   └── validate.js
├── models/
│   ├── Company.js
│   ├── User.js
│   ├── Ticket.js
│   ├── Conversation.js
│   ├── Document.js
│   ├── Article.js
│   ├── Team.js
│   ├── Lead.js
│   └── Plan.js
├── routes/
│   ├── auth.js
│   ├── tickets.js
│   ├── chat.js
│   ├── team.js
│   ├── knowledge.js
│   ├── analytics.js
│   ├── billing.js
│   ├── settings.js
│   ├── dashboard.js
│   ├── documents.js
│   └── leads.js
├── services/
│   ├── geminiService.js      # AI reply generation
│   └── pdfService.js         # PDF parsing
├── utils/
│   ├── AppError.js
│   ├── catchAsync.js
│   └── token.js
├── .env
├── server.js                 # Entry point
└── package.json
```

---

## Roadmap

- [ ] Redis caching for analytics queries
- [ ] Email service (SendGrid/SES) for password reset + invites
- [ ] Webhooks for external integrations
- [ ] Audit logs
- [ ] AI training via fine-tuning
- [ ] Multi-language support
- [ ] SLA policies + auto-escalation
- [ ] Custom fields on tickets

---

## License

MIT

---

## Support

For issues or questions: support@supportai.com
