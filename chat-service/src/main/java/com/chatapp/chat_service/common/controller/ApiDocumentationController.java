package com.chatapp.chat_service.common.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ApiDocumentationController {

    @GetMapping(value = "/", produces = MediaType.TEXT_HTML_VALUE)
    public String getApiDocumentation() {
        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Chat App API Documentation</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            margin: 0;
                            padding: 20px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            min-height: 100vh;
                        }
                        .container {
                            max-width: 1200px;
                            margin: 0 auto;
                            background: white;
                            border-radius: 12px;
                            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                            overflow: hidden;
                        }
                        .header {
                            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                            color: white;
                            padding: 40px;
                            text-align: center;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 2.5em;
                            font-weight: 700;
                        }
                        .header p {
                            margin: 10px 0 0 0;
                            font-size: 1.2em;
                            opacity: 0.9;
                        }
                        .content {
                            padding: 40px;
                        }
                        .section {
                            margin-bottom: 40px;
                        }
                        .section h2 {
                            color: #2d3748;
                            font-size: 1.8em;
                            margin-bottom: 20px;
                            border-bottom: 3px solid #4facfe;
                            padding-bottom: 10px;
                        }
                        .endpoint {
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            margin-bottom: 20px;
                            overflow: hidden;
                        }
                        .endpoint-header {
                            background: #4facfe;
                            color: white;
                            padding: 15px 20px;
                            font-weight: 600;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        .method {
                            background: rgba(255,255,255,0.2);
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 0.85em;
                            font-weight: 700;
                        }
                        .endpoint-body {
                            padding: 20px;
                        }
                        .endpoint-description {
                            color: #4a5568;
                            margin-bottom: 15px;
                            line-height: 1.6;
                        }
                        .example {
                            background: #2d3748;
                            color: #e2e8f0;
                            padding: 15px;
                            border-radius: 6px;
                            font-family: 'Courier New', monospace;
                            font-size: 0.9em;
                            overflow-x: auto;
                            margin-bottom: 15px;
                        }
                        .feature-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                            gap: 20px;
                            margin-bottom: 30px;
                        }
                        .feature-card {
                            background: #f7fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            padding: 20px;
                            text-align: center;
                        }
                        .feature-icon {
                            font-size: 2em;
                            margin-bottom: 10px;
                        }
                        .feature-title {
                            font-weight: 600;
                            color: #2d3748;
                            margin-bottom: 10px;
                        }
                        .feature-desc {
                            color: #4a5568;
                            font-size: 0.9em;
                            line-height: 1.5;
                        }
                        .status-badge {
                            background: #48bb78;
                            color: white;
                            padding: 4px 12px;
                            border-radius: 20px;
                            font-size: 0.8em;
                            font-weight: 600;
                            display: inline-block;
                            margin-bottom: 20px;
                        }
                        .tech-stack {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 10px;
                            margin-top: 20px;
                        }
                        .tech-badge {
                            background: #667eea;
                            color: white;
                            padding: 6px 12px;
                            border-radius: 20px;
                            font-size: 0.85em;
                            font-weight: 500;
                        }
                        @media (max-width: 768px) {
                            .container { margin: 10px; border-radius: 8px; }
                            .header { padding: 30px 20px; }
                            .content { padding: 20px; }
                            .feature-grid { grid-template-columns: 1fr; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🚀 Chat App API</h1>
                            <p>Comprehensive Real-time Chat Application API Documentation</p>
                            <div class="status-badge">✅ Production Ready</div>
                        </div>
                        
                        <div class="content">
                            <!-- Features Overview -->
                            <div class="section">
                                <h2>🎯 Core Features</h2>
                                <div class="feature-grid">
                                    <div class="feature-card">
                                        <div class="feature-icon">💬</div>
                                        <div class="feature-title">Real-time Messaging</div>
                                        <div class="feature-desc">Send & receive messages instantly with WebSocket STOMP protocol</div>
                                    </div>
                                    <div class="feature-card">
                                        <div class="feature-icon">🔔</div>
                                        <div class="feature-title">Smart Notifications</div>
                                        <div class="feature-desc">Real-time notifications with Redis caching & Kafka events</div>
                                    </div>
                                    <div class="feature-card">
                                        <div class="feature-icon">❤️</div>
                                        <div class="feature-title">Message Reactions</div>
                                        <div class="feature-desc">React to messages with emojis and real-time updates</div>
                                    </div>
                                    <div class="feature-card">
                                        <div class="feature-icon">📎</div>
                                        <div class="feature-title">File Attachments</div>
                                        <div class="feature-desc">Send images, documents and multimedia files</div>
                                    </div>
                                    <div class="feature-card">
                                        <div class="feature-icon">📌</div>
                                        <div class="feature-title">Message Pinning</div>
                                        <div class="feature-desc">Pin important messages in conversations</div>
                                    </div>
                                    <div class="feature-card">
                                        <div class="feature-icon">📊</div>
                                        <div class="feature-title">Interactive Polls</div>
                                        <div class="feature-desc">Create and vote on polls within conversations</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Message API -->
                            <div class="section">
                                <h2>💬 Message API</h2>
                                
                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">POST</span>
                                        <span>/api/messages</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Send a new message to a conversation</div>
                                        <div class="example">curl -X POST http:
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {token}" \\
  -d '{
    "conversationId": "uuid",
    "content": "Hello world!",
    "senderId": "uuid"
  }'</div>
                                    </div>
                                </div>

                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">GET</span>
                                        <span>/api/messages/{conversationId}</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Get paginated messages for a conversation</div>
                                        <div class="example">curl -X GET "http://localhost:8084/api/messages/{conversationId}?page=0&size=20" \\
  -H "Authorization: Bearer {token}"</div>
                                    </div>
                                </div>

                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">POST</span>
                                        <span>/api/messages/{conversationId}/{messageId}/reactions/{emoji}</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Toggle reaction on a message (❤️, 👍, 😂, 😮, 😢, 😡)</div>
                                        <div class="example">curl -X POST http:
  -H "Authorization: Bearer {token}"</div>
                                    </div>
                                </div>

                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">POST</span>
                                        <span>/api/messages/{conversationId}/{messageId}/read</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Mark message as read (creates read receipt)</div>
                                        <div class="example">curl -X POST http:
  -H "Authorization: Bearer {token}"</div>
                                    </div>
                                </div>

                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">POST</span>
                                        <span>/api/messages/{conversationId}/{messageId}/pin</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Toggle pin status of a message</div>
                                        <div class="example">curl -X POST http:
  -H "Authorization: Bearer {token}"</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Notification API -->
                            <div class="section">
                                <h2>🔔 Notification API</h2>
                                
                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">GET</span>
                                        <span>/api/notifications</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Get paginated notifications for current user</div>
                                        <div class="example">curl -X GET "http://localhost:8084/api/notifications?page=0&size=20" \\
  -H "Authorization: Bearer {token}"</div>
                                    </div>
                                </div>

                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">GET</span>
                                        <span>/api/notifications/unread/count</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Get count of unread notifications</div>
                                        <div class="example">curl -X GET http:
  -H "Authorization: Bearer {token}"

Response: {"count": 5}</div>
                                    </div>
                                </div>

                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">PUT</span>
                                        <span>/api/notifications/{notificationId}/read</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Mark specific notification as read</div>
                                        <div class="example">curl -X PUT http:
  -H "Authorization: Bearer {token}"</div>
                                    </div>
                                </div>

                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">PUT</span>
                                        <span>/api/notifications/read-all</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Mark all notifications as read</div>
                                        <div class="example">curl -X PUT http:
  -H "Authorization: Bearer {token}"</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Poll API -->
                            <div class="section">
                                <h2>📊 Poll API</h2>
                                
                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">POST</span>
                                        <span>/api/polls</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Create a new poll in conversation</div>
                                        <div class="example">curl -X POST http:
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {token}" \\
  -d '{
    "conversationId": "uuid",
    "question": "What should we order for lunch?",
    "options": ["Pizza", "Burger", "Sushi"],
    "expiresAt": "2025-01-15T18:00:00Z"
  }'</div>
                                    </div>
                                </div>

                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">POST</span>
                                        <span>/api/polls/{pollId}/vote</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Vote on a poll option</div>
                                        <div class="example">curl -X POST http:
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {token}" \\
  -d '{"optionIndex": 0}'</div>
                                    </div>
                                </div>

                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">GET</span>
                                        <span>/api/polls/{pollId}/results</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Get poll results with vote counts</div>
                                        <div class="example">curl -X GET http:
  -H "Authorization: Bearer {token}"</div>
                                    </div>
                                </div>
                            </div>

                            <!-- WebSocket -->
                            <div class="section">
                                <h2>🔌 WebSocket Real-time</h2>
                                <div class="endpoint">
                                    <div class="endpoint-header">
                                        <span class="method">WS</span>
                                        <span>/ws</span>
                                    </div>
                                    <div class="endpoint-body">
                                        <div class="endpoint-description">Connect to WebSocket for real-time updates</div>
                                        <div class="example">
const socket = new SockJS('http://localhost:8084/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({Authorization: 'Bearer ' + token}, function() {
    stompClient.subscribe('/user/queue/notifications', function(notification) {
        console.log('New notification:', JSON.parse(notification.body));
    });
    
    stompClient.subscribe('/topic/conversation/' + conversationId, function(message) {
        console.log('New message:', JSON.parse(message.body));
    });
});</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Tech Stack -->
                            <div class="section">
                                <h2>🛠️ Technology Stack</h2>
                                <div class="tech-stack">
                                    <span class="tech-badge">Spring Boot 3.x</span>
                                    <span class="tech-badge">Apache Cassandra</span>
                                    <span class="tech-badge">Redis Cache</span>
                                    <span class="tech-badge">Apache Kafka</span>
                                    <span class="tech-badge">WebSocket STOMP</span>
                                    <span class="tech-badge">Spring Security JWT</span>
                                    <span class="tech-badge">Docker</span>
                                </div>
                            </div>

                            <!-- Quick Start -->
                            <div class="section">
                                <h2>🚀 Quick Start</h2>
                                <div class="example">
curl -X POST http:
  -H "Content-Type: application/json" \\
  -d '{"username": "user", "password": "password"}'

curl -X GET http:
  -H "Authorization: Bearer {your-jwt-token}"

const token = localStorage.getItem('authToken');
const socket = new SockJS('http://localhost:8084/ws');
const stompClient = Stomp.over(socket);
stompClient.connect({Authorization: 'Bearer ' + token}, onConnected);</div>
                            </div>

                            <!-- Footer -->
                            <div style="text-align: center; padding: 40px 0; border-top: 1px solid #e2e8f0; margin-top: 40px; color: #4a5568;">
                                <p><strong>Chat App API v1.0</strong> - Built with ❤️ using Spring Boot</p>
                                <p>📚 For detailed API docs: <a href="/NOTIFICATION_API.md" style="color: #4facfe;">Notification Guide</a> | 
                                   <a href="/FRONTEND_INTEGRATION.md" style="color: #4facfe;">Frontend Integration</a></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                """;
    }

    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getHealthCheck() {
        return """
                {
                    "status": "UP",
                    "service": "Chat Service",
                    "version": "1.0.0",
                    "timestamp": "%s",
                    "features": {
                        "messaging": "✅ Active",
                        "notifications": "✅ Active", 
                        "websocket": "✅ Active",
                        "redis_cache": "✅ Active",
                        "kafka": "✅ Active",
                        "cassandra": "✅ Active"
                    }
                }
                """.formatted(java.time.Instant.now());
    }

    @GetMapping(value = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getApiInfo() {
        return """
                {
                    "name": "Chat App API",
                    "version": "1.0.0",
                    "description": "Comprehensive real-time chat application API with advanced features",
                    "baseUrl": "http://localhost:8084",
                    "endpoints": {
                        "messages": "/api/messages",
                        "notifications": "/api/notifications", 
                        "polls": "/api/polls",
                        "websocket": "/ws"
                    },
                    "features": [
                        "Real-time messaging",
                        "Smart notifications", 
                        "Message reactions",
                        "File attachments",
                        "Message pinning",
                        "Interactive polls",
                        "Read receipts",
                        "WebSocket real-time updates"
                    ],
                    "documentation": {
                        "web": "/",
                        "notification_guide": "/NOTIFICATION_API.md",
                        "frontend_integration": "/FRONTEND_INTEGRATION.md"
                    }
                }
                """;
    }
}
