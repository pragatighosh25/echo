# Echo — Real-Time Collaborative Workspace

Echo is a production-grade full-stack web application designed from first principles to demonstrate distributed synchronization, event-driven micro-services, and concurrent real-time document editing.

The backbone of Echo is a **custom Operational Transformation (OT) sync engine** running over a server-authoritative log and client-side index rebasing protocol, completely free of any external CRDT libraries.

---

## 🏗️ Architecture

```
                    Next.js Frontend (Port 3000)
                           │
                    REST + Socket.IO
                           │
                 Express Backend API (Port 4000)
 ┌────────────────────────────────────────────────────────┐
 │ - Auth (JWT & RBAC)     - Workspaces & Projects        │
 │ - Documents CRUD        - Custom Sync Socket Handler   │
 │ - Tasks (Kanban)        - comments & @Mentions         │
 │ - Search (Fuzzy scope)  - AI Job dispatchers           │
 └────────────────────────────────────────────────────────┘
                           │
                    Kafka Event Bus (Port 9092)
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
 Redis (Cache)       BullMQ Worker       PostgreSQL DB
 (Presence/Typing)   (AI/Exports)        (Prisma ORM)
```

- **Next.js (App Router)**: Fast, server-side layouts rendering modular Tailwind components.
- **Express Server**: Serving REST endpoints and hosting the Socket.IO cluster.
- **Prisma & PostgreSQL**: Relational data, transaction locks, and operational logs.
- **Redis Cache**: Instant presence registers, cursor tracking, and active typing states.
- **Apache Kafka**: Message broker coordinating system audit records, notification alerts, and search updates.
- **BullMQ Workers**: Handling decoupled asynchronous background actions (AI parsing, text compiling, document exporting).
- **S3 Storage Simulator**: Mock file writer copying uploads locally and serving static web assets.

---

## 📁 Project Folder Structure

```
collab/
├── docker-compose.yml          # Coordinates PostgreSQL, Redis, Kafka, Zookeeper
├── README.md                   # Full deployment & developer handbook
├── backend/
│   ├── src/
│   │   ├── services/           # Shared adapters (DB, Redis, Kafka, BullMQ, S3)
│   │   ├── modules/            # Isolated Monolith Domains
│   │   │   ├── auth/           # JWT Tokens, Password hashing, RBAC Middleware
│   │   │   ├── workspaces/     # Workspace invites, role transfers, activities
│   │   │   ├── projects/       # Project scopes
│   │   │   ├── documents/      # Document CRUD and database state Initializers
│   │   │   ├── sync/           # Custom OT transform blocks and sockets
│   │   │   ├── tasks/          # Kanban tasks, statuses, priorities, assignments
│   │   │   ├── comments/       # Threaded comments, resolves, and @Mentions
│   │   │   ├── search/         # Workspace-scoped global fuzzy queries
│   │   │   ├── notifications/  # User alert records and markers
│   │   │   ├── ai/             # Asynchronous BullMQ AI task queues
│   │   │   └── exports/        # Asynchronous BullMQ Document exporters
│   │   ├── app.ts              # Express routes, static asset links, errors
│   │   ├── server.ts           # Boot server, Sockets, and Kafka consumers
│   │   └── worker.ts           # BullMQ Workers (AI processors, Export compilers)
│   ├── prisma/
│   │   └── schema.prisma       # Database schemas & relations
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── app/                # Pages (Landing, Login, Signup, Dashboard)
    │   ├── components/         # UIs (Collapsible Sidebar, Command Palette, Editor)
    │   ├── hooks/              # Zustand Auth Store, Custom OT Sync Hook
    │   └── lib/                # API client (JWT refresh interceptors), Sockets client
    ├── package.json
    └── tailwind.config.js
```

---

## 🔗 APIs & Socket Events

### HTTP REST Endpoints
* **Auth**:
  - `POST /auth/signup` - Register user.
  - `POST /auth/login` - Authenticate & return tokens.
  - `POST /auth/refresh` - Swap refresh token for access token.
* **Workspaces**:
  - `POST /workspaces` - Create workspace (caller becomes OWNER).
  - `POST /workspaces/:id/invite` - Invite member by email (ADMIN/EDITOR/VIEWER).
  - `DELETE /workspaces/:id/members/:userId` - Remove member.
  - `POST /workspaces/:id/transfer-owner` - Transfer OWNER role.
  - `POST /workspaces/:id/archive` - Soft-archive workspace.
* **Documents**:
  - `GET /documents/documents/:id` - Initial content fetch.
  - `POST /documents/projects/:projectId/documents` - Add document (Rev 0).
* **Tasks**:
  - `GET /tasks/projects/:projectId/tasks` - List project tasks.
  - `PATCH /tasks/tasks/:id` - Update status (Todo/In Progress/Review/Completed), priority, or assignee.
* **AI Features**:
  - `POST /ai/process` - Dispatch AI action (Summarize, rewrite) to BullMQ.
  - `GET /ai/jobs/:jobId` - Poll status.

### WebSockets Channels (Socket.IO)
- `join-document` (client $\rightarrow$ server): Join document room.
- `submit-operation` (client $\rightarrow$ server): Submit operational edits.
- `operation-acknowledged` (server $\rightarrow$ client): Confirms operation is saved.
- `operation-broadcast` (server $\rightarrow$ other clients): Broadcasts changes.
- `operation-rejected` (server $\rightarrow$ client): Fired on version conflicts. Returns list of newer edits to replay/rebase.
- `presence-update` & `typing-update` (client $\rightarrow$ server): Broadcasts current user cursor focus and typing status.
- `notification-alert` (server $\rightarrow$ client): Delivers real-time toast alerts.

---

## 📬 Event Streaming (Kafka Topics)
- `document.operations`: Track operational edits for time-travel audits.
- `workspace.events`: Membership audits (joins, leaves, project adds).
- `comments.events`: Broadcasts comment threads.
- `notification.events`: Consumed by backend server to save and alert users of comments, invites, and assignments.
- `activity.events`: Feeds chronological timeline.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/echo_db?schema=public"
REDIS_URL="redis://localhost:6379"
KAFKA_BROKERS="localhost:9092"
JWT_SECRET="echo_jwt_access_secret"
JWT_REFRESH_SECRET="echo_jwt_refresh_secret"
```

---

## 🚀 Step-by-Step Setup Guide (Manual Steps)

Follow these steps on your system to run the application:

### Step 1: Start Docker Compose Services
First, spin up PostgreSQL, Redis, Zookeeper, and Kafka. Run the following command in the root folder containing `docker-compose.yml`:
```bash
docker compose up -d
```
Check that the containers are running:
```bash
docker compose ps
```

### Step 2: Install Backend Dependencies & Init DB
Navigate into the `backend/` folder:
```bash
cd backend
npm install
```
Next, push the schema to the database (this will initialize PostgreSQL and generate the Prisma Client):
```bash
npx prisma db push
```

### Step 3: Start the Backend REST & Socket Server
Start the Express server in development mode:
```bash
npm run dev
```

### Step 4: Start the Background Worker Process
Open a **new terminal tab**, navigate to `backend/`, and start the BullMQ worker service:
```bash
npm run build
# Or run with ts-node directly
npx ts-node src/worker.ts
```

### Step 5: Run the Sync Engine Integration Tests
To verify that the custom Operational Transformation (OT) index-shifting logic resolves concurrent edits properly, run:
```bash
npm run test:sync
```

### Step 6: Set Up & Launch Next.js Frontend
Open a **third terminal tab**, navigate into the `frontend/` folder:
```bash
cd ../frontend
npm install
```
Start the Next.js client dev server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🛠️ Verification & Testing Scenarios
1. **Real-time Collaboration**: Open two browser windows (one in Incognito Mode). Sign in with two different accounts. Navigate to the same document and type concurrently. You will see colored borders, cursor movements, and letters merging instantly.
2. **Offline Mode**: Block your network tab inside Chrome dev tools. Keep typing. The changes are accumulated locally. Re-enable the network. You will see the socket reconnect and play back your operations cleanly.
3. **AI Task Queue**: Select a block, open the AI Spark panel, and trigger "Summarize Block". You will notice the status sets to "processing". BullMQ handles the job asynchronously in the background. Once completed, the block text is automatically replaced by the summary.
