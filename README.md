# Nối (ChatApp) - Monorepo

Nối is a real-time conversation app built with a Spring Boot modular monolith
and a Next.js frontend. Feature readiness and remaining integration checks are
tracked in the [readiness checklist](./tasks/readiness/todo.md).

## 📂 Project Structure

This repository is structured as a **Monorepo** containing both the Frontend and Backend applications:

- **[`/chat-service`](./chat-service/)**: The backend server built with **Java (Spring Boot 3)**. It uses **Apache Cassandra** as the primary data store, **Redis** for ephemeral realtime state/rate limits, **Kafka** for durable events, **Elasticsearch** for rebuildable search projections, and **WebSocket (STOMP)** for realtime messaging.
- **[`/chatapp_frontend`](./chatapp_frontend/)**: The Frontend application (Next.js 16 App Router + React/TypeScript).

The global operator console is integrated into these same two projects: the web
client exposes protected `/admin`, while Spring owns `/api/admin/**`. It is not a
room-local admin role; room-local conversation roles remain a separate domain.

---

## 🚀 Quick Setup

Windows + VS Code: follow the [complete local setup guide](./docs/LOCAL_WINDOWS_SETUP.md)
for JDK selection, Docker health checks, database initialization/migrations and
Firebase credentials. It also records the remaining live verification gates.

Once Docker Desktop and JDK 20+ are installed, run `npm run local`
from this repository root to start infrastructure, initialize the current schema
on an empty database, and run backend/frontend in one terminal. No migrations or
data deletion are performed automatically. Missing local `.env` files are created
from examples with a random JWT key; existing configurations are preserved.

### 1. Start the Backend Infrastructure
The default Compose manifest starts the canonical local stack: Cassandra plus
schema initialization, Redis, Kafka and Elasticsearch. Cloudinary remains an
external provider configured through environment variables.

Navigate to the backend directory and start the core infrastructure:
```bash
cd chat-service
docker-compose up -d
```

The explicit `docker-compose-full.yml` manifest has the same required services
for CI or deployment scripts.

### 2. Run the Backend Service
Ensure you have Java 20+ installed. Still inside the `chat-service` directory:
```bash
./mvnw clean install
./mvnw spring-boot:run
```
*The backend server will run on `http://localhost:8084`*

### 3. Run the Frontend Application
Open a new terminal, navigate to the frontend directory, install dependencies, and start the development server:
```bash
cd chatapp_frontend
npm install           # Or yarn / pnpm install
npm run dev           # Or yarn dev
```

From the repository root, `npm run dev`, `npm run build` and `npm run validate`
delegate to the frontend. They do not start or verify the backend infrastructure;
run the Maven and Compose commands above separately.

---

## 📖 Detailed Documentation

Each module has its own detailed documentation. Please refer to them for specific API references, architecture details, and setup guides:

- 🔗 **[Backend (chat-service) README](./chat-service/README.md)**
- 🔗 **[Backend API Reference & Endpoints](./chat-service/API_REFERENCE.md)**
- 🔗 **[Social & Messaging Technical Guide](./TECHNICAL_SOCIAL_MESSAGING.md)**
- 🔗 **[Product brief](./PRODUCT.md)**
- 🔗 **[Feature inventory](./docs/FEATURE_INVENTORY.md)**
- 🔗 **[Readiness plan](./tasks/readiness/plan.md)**, **[form/state requirements](./tasks/readiness/forms-and-states.md)** and **[current evidence](./tasks/readiness/review.md)**
- 🔗 **[Traceability matrix](./docs/TRACEABILITY_MATRIX.md)**
- 🔗 **[End-to-end work plan](./docs/AGENT_WORK_PLAN.md)**
- 🔗 **[Global admin console plan](./docs/ADMIN_PLAN.md)**
- 🔗 **[Final documentation self-review](./docs/SELF_REVIEW_STATUS.md)**
- 🔗 **[OpenAPI contract](./docs/api/openapi.yaml)** and **[AsyncAPI realtime contract](./docs/api/asyncapi.yaml)**
- 🔗 **[Firebase Google auth setup](./docs/FIREBASE_GOOGLE_AUTH_SETUP.md)**

## 🤝 Contributing
For contributing guidelines and coding standards, please read the **[CONTRIBUTING.md](./chat-service/CONTRIBUTING.md)** file inside the `chat-service` folder.

## 📄 License
This project is open-source and available under the terms of the MIT License.
