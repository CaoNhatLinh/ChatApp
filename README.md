# NovaChat (ChatApp) - Monorepo

Welcome to the **NovaChat** repository. This is a complete, real-time chat application designed with a microservices-inspired architecture, featuring a robust backend and a modern frontend interface.

## 📂 Project Structure

This repository is structured as a **Monorepo** containing both the Frontend and Backend applications:

- **[`/chat-service`](./chat-service/)**: The Backend server built with **Java (Spring Boot 3)**. It handles real-time messaging via WebSockets (STOMP), data persistence with **Apache Cassandra**, caching with **Redis**, event streaming with **Apache Kafka**, and full-text search with **Elasticsearch**.
- **[`/chatapp_frontend`](./chatapp_frontend/)**: The Frontend application (React/TypeScript).

---

## 🚀 Quick Setup

### 1. Start the Backend Infrastructure
The backend relies on several services (Cassandra, Redis, Kafka, Zookeeper) which are containerized using Docker. All configurations are located within the `chat-service` directory.

Navigate to the backend directory and start the core infrastructure:
```bash
cd chat-service
docker-compose up -d
```

*(Optional)* If you want to enable the Search capabilities, start Elasticsearch as well:
```bash
docker-compose -f docker-compose-elasticsearch.yml up -d
```

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
- 🔗 **[Incomplete Features (Backend)](./chat-service/INCOMPLETE_FEATURES.md)**
- 🔗 **[Roadmap & Future Plans (Backend)](./chat-service/ROADMAP.md)**

## 🤝 Contributing
For contributing guidelines and coding standards, please read the **[CONTRIBUTING.md](./chat-service/CONTRIBUTING.md)** file inside the `chat-service` folder.

## 📄 License
This project is open-source and available under the terms of the MIT License.
