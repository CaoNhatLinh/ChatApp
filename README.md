# NovaChat (ChatApp) - Monorepo

Welcome to the **NovaChat** repository. This is a complete, real-time chat application designed with a microservices-inspired architecture, featuring a robust backend and a modern frontend interface.

## 📂 Project Structure

This repository is structured as a **Monorepo** containing both the Frontend and Backend applications:

- **[`/chat-service`](./chat-service/)**: The backend server built with **Java (Spring Boot 3)**. It uses **Apache Cassandra** as the primary data store, **Redis** for ephemeral realtime state/rate limits, **Kafka** for durable events, **Elasticsearch** for rebuildable search projections, and **WebSocket (STOMP)** for realtime messaging.
- **[`/chatapp_frontend`](./chatapp_frontend/)**: The Frontend application (Next.js 16 App Router + React/TypeScript).

The global operator console is integrated into these same two projects: the web
client exposes protected `/admin`, while Spring owns `/api/admin/**`. It is not a
room-local admin role; room-local conversation roles remain a separate domain.

---

## 🚀 Quick Setup

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

---

## 📖 Detailed Documentation

Each module has its own detailed documentation. Please refer to them for specific API references, architecture details, and setup guides:

- 🔗 **[Backend (chat-service) README](./chat-service/README.md)**
- 🔗 **[Backend API Reference & Endpoints](./chat-service/API_REFERENCE.md)**
- 🔗 **[Social & Messaging Technical Guide](./TECHNICAL_SOCIAL_MESSAGING.md)**
- 🔗 **[Product brief](./PRODUCT.md)**
- 🔗 **[Feature inventory](./docs/FEATURE_INVENTORY.md)**
- 🔗 **[Traceability matrix](./docs/TRACEABILITY_MATRIX.md)**
- 🔗 **[End-to-end work plan](./docs/AGENT_WORK_PLAN.md)**
- 🔗 **[Global admin console plan](./docs/ADMIN_PLAN.md)**
- 🔗 **[Final documentation self-review](./docs/SELF_REVIEW_STATUS.md)**
- 🔗 **[OpenAPI contract](./docs/api/openapi.yaml)** and **[AsyncAPI realtime contract](./docs/api/asyncapi.yaml)**

## 🤝 Contributing
For contributing guidelines and coding standards, please read the **[CONTRIBUTING.md](./chat-service/CONTRIBUTING.md)** file inside the `chat-service` folder.

## 📄 License
This project is open-source and available under the terms of the MIT License.
