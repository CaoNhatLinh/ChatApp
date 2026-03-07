# NovaChat Backend Architecture

This document provides a high-level overview of the backend architecture for NovaChat. It explains how different technologies interact to deliver a scalable, real-time messaging experience.

## Core Technologies & Responsibility

1. **Spring Boot (Java 20)**: The core application framework handling REST APIs, WebSocket connections, security (JWT), and business logic.
2. **Apache Cassandra**: The primary database. Used for storing historical data (Users, Conversations, Messages, Notifications). Chosen for its high write throughput and horizontal scalability, ideal for a chat application's append-heavy workload.
3. **Redis**: Used as an in-memory data store for caching and real-time state.
   - Caches frequently accessed data (User profiles, Conversational metadata).
   - Manages WebSocket Session states and Presence (Online/Offline) via expiring keys (TTL).
4. **Apache Kafka**: An event streaming platform enabling asynchronous processing.
   - Decouples heavy operations (e.g. sending a chat message triggers a Kafka event, which is then picked up by the Notification service to push alerts to offline users).
5. **Elasticsearch**: The search engine.
   - Synchronizes with Cassandra to provide fast full-text search capabilities across conversations and messages.
6. **Cloudinary**: External cloud storage for handling media uploads (Images, Videos, Files).

---

## High-Level Data Flow

### 1. Sending a Message
1. **Client** sends a message payload via WebSocket (`/app/message.send`) or REST.
2. **MessageController/WebSocketChatController** receives the payload.
3. The message is immediately broadcast back to the sender (`/user/queue/message-echo`) for instant UI feedback.
4. An event is dispatched to **Kafka** (`message-topic`).
5. **Kafka Consumers** process the event:
   - Save the message to **Cassandra**.
   - Sync the message text to **Elasticsearch**.
   - Broadcast the message to all active participants via WebSocket (`/topic/conversation/{id}`).
   - Check participant presence in **Redis**; if a user is offline, trigger a Push Notification via the **Notification Service**.

### 2. Presence System (Online/Typing)
1. **Client** sends a periodic heartbeat or typing event via WebSocket.
2. **Spring Boot** updates a key in **Redis** with a short TTL (e.g., 5 seconds for typing, 60 seconds for online status).
3. If the TTL expires (user disconnects or stops typing), Redis emits a Keyspace Notification or the absence of the key is noted during polling.
4. **WebSocket** broadcasts the updated status to relevant subscribers.

---

## Database Design (Cassandra)
Due to Cassandra's NoSQL nature, data is mostly denormalized and queried by partition keys.

- `users`: Partitioned by `id`.
- `conversations`: Partitioned by `id`.
- `conversation_members`: Composite partition keys for fast lookup of "which conversations a user is in".
- `messages`: Partitioned by `conversationId`, clustered by `createdAt` (DESC) to allow efficient fetching of the latest messages.

---

## Security Model
- **Authentication**: Stateless JWT tokens passed in the `Authorization` header for HTTP, and injected during the WebSocket STOMP `CONNECT` frame.
- **Authorization**: Pre-checks on controllers to ensure users can only access conversations they are members of.

---

## Future Scaling Considerations
- **Event-Driven Microservices**: While currently a modular monolith, the heavy use of Kafka allows easy extraction of the Notification or Search components into independent microservices.
- **Presence Fan-out**: For millions of concurrent users, the current Redis TTL model will transition to a distributed Pub/Sub fan-out architecture.
