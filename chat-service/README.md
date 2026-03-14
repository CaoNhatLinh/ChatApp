# NovaChat Backend

A real-time chat application backend built with Spring Boot, featuring WebSocket communication, Elasticsearch search, and comprehensive notification system.

## 🚀 Features

### ✅ Implemented Features

- **Real-time Messaging**: WebSocket-based instant messaging with STOMP protocol
- **File Attachments**: Support for images, videos, audio, and documents via Cloudinary
- **Typing Indicators**: Real-time typing status with Redis TTL (2s auto-expiry)
- **User Presence System**: Basic online/offline status tracking (session-based)
- **Friend Management**: Send/accept/reject friend requests and manage friend list
- **Conversation Management**: 
  - DM (Direct Message) conversations
  - Group conversations
  - Soft delete with restore capability
  - Conversation search via Elasticsearch
- **Notification System**: 
  - Real-time notifications via WebSocket
  - Kafka event streaming for scalability
  - Persistent notifications for friend requests, DM messages, mentions, replies, reactions, pins, polls, and system events
- **Message Features**:
  - Reply to messages
  - Message deletion
  - Message editing with revision history
  - Message pinning with server-side limits
  - Read receipts
  - Conversation unread counts
  - Last message preview in conversation lists
  - Mention parsing and mention notifications
  - File and media attachments persisted with message records
  - Immediate echo feedback for better UX
- **Authentication**: JWT-based authentication with Spring Security
- **Caching**: Redis caching for optimal performance
- **WebSocket**: STOMP over WebSocket for bidirectional communication

### 🚧 Partially Implemented / In Progress

- **User Presence System**: Device-aware online state is exposed, but large-scale fan-out optimization is still pending
- **Search**: Conversation search works, and mention-oriented message search exists; general-purpose message search still needs refinement

### ❌ Not Yet Implemented

- **Audit Logging**: Detailed tracking of user activities
- **Voice/Video Calls**: Real-time audio/video communication
- **Advanced Presence**: Fan-out presence system for very large-scale deployments

## 🛠️ Tech Stack

- **Java 20** with Spring Boot 3.5.3
- **Apache Cassandra** - Primary database for chat data
- **Redis** - Caching and session management
- **Elasticsearch** - Search engine for conversations and messages
- **Apache Kafka** - Message queue for event streaming
- **WebSocket (STOMP)** - Real-time bidirectional communication
- **Spring Security** - Authentication and authorization
- **Docker & Docker Compose** - Containerization

## 📋 Prerequisites

- Java 20 or higher
- Docker and Docker Compose
- Maven 3.6+

## 🔧 Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/CaoNhatLinh/NovaChat-backend.git
cd NovaChat-backend
```

### 2. Start required services with Docker

```bash
# Start Cassandra, Redis, Kafka, Zookeeper
docker-compose up -d

# Optional: Start Elasticsearch (if using search features)
docker-compose -f docker-compose-elasticsearch.yml up -d
```

### 3. Configure application

Update `src/main/resources/application.properties` with your configurations:

```properties
# Cassandra
spring.cassandra.keyspace-name=chat_db
spring.cassandra.contact-points=localhost
spring.cassandra.port=9042

# Redis
spring.data.redis.host=localhost
spring.data.redis.port=6379

# Kafka
spring.kafka.bootstrap-servers=localhost:9092

# Elasticsearch (optional)
spring.elasticsearch.uris=http://localhost:9200
```

### 4. Build and run

```bash
# Build the project
./mvnw clean install

# Run the application
./mvnw spring-boot:run
```

The application will start on `http://localhost:8084`

## 📚 API Documentation

For complete REST & WebSocket API documentation, please refer to:
👉 **[API_REFERENCE.md](./API_REFERENCE.md)**

## 📖 Project Documentation

### Core Documents
- **[API Reference](./API_REFERENCE.md)** - Complete documentation for Endpoints and WebSockets.
- **[Social & Messaging Technical Guide](../TECHNICAL_SOCIAL_MESSAGING.md)** - Cross-layer behavior for friendship, block, unread/read, notifications, pinning, reply, attachments, and presence.
- **[Roadmap & Future Plans](./ROADMAP.md)** - Feature development plan.
- **[Incomplete Features](./INCOMPLETE_FEATURES.md)** - ⚠️ Track unfinished modules and known limitations.
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👤 Author

**Cao Nhat Linh**

- GitHub: [@CaoNhatLinh](https://github.com/CaoNhatLinh)

## 🙏 Acknowledgments

- Spring Boot Team for the excellent framework
- Apache Cassandra, Kafka, and Elasticsearch communities
- STOMP.js and SockJS for WebSocket support
- All contributors and users of this project
