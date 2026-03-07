# Contributing to NovaChat Backend

Thank you for your interest in contributing to NovaChat Backend! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

---

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and considerate.

### Expected Behavior

- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

---

## 🚀 Getting Started

### Prerequisites

- Java 20 or higher
- Maven 3.6+
- Docker & Docker Compose
- Git
- IDE (IntelliJ IDEA recommended)

### Setup Development Environment

1. **Fork the repository**
```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/NovaChat-backend.git
cd NovaChat-backend
```

2. **Add upstream remote**
```bash
git remote add upstream https://github.com/CaoNhatLinh/NovaChat-backend.git
```

3. **Start dependencies**
```bash
docker-compose up -d
```

4. **Run the application**
```bash
./mvnw spring-boot:run
```

5. **Verify setup**
- Application should start on `http://localhost:8084`
- WebSocket endpoint: `ws://localhost:8084/ws`

---

## 💻 Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b bugfix/issue-description
```

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/voice-calling`)
- `bugfix/` - Bug fixes (e.g., `bugfix/typing-indicator-stuck`)
- `hotfix/` - Critical fixes for production (e.g., `hotfix/security-patch`)
- `refactor/` - Code refactoring (e.g., `refactor/service-layer`)
- `docs/` - Documentation updates (e.g., `docs/api-documentation`)
- `test/` - Test additions/updates (e.g., `test/message-service`)

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed
- Add tests for new features

### 3. Test Your Changes

```bash
# Run all tests
./mvnw test

# Run specific test
./mvnw test -Dtest=MessageServiceTest

# Check code coverage
./mvnw jacoco:report
```

### 4. Commit Your Changes

Follow our [commit guidelines](#commit-guidelines).

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## 🎨 Coding Standards

### Java Code Style

- **Indentation**: 4 spaces (no tabs)
- **Line length**: Maximum 120 characters
- **Naming conventions**:
  - Classes: `PascalCase` (e.g., `MessageService`)
  - Methods: `camelCase` (e.g., `sendMessage`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_MESSAGE_LENGTH`)
  - Variables: `camelCase` (e.g., `userId`)

### Code Organization

```
src/main/java/com/chatapp/chat_service/
├── config/           # Configuration classes
├── controller/       # REST & WebSocket controllers
├── service/          # Business logic
│   ├── message/     # Message-related services
│   ├── presence/    # Presence-related services
│   └── ...
├── repository/       # Data access layer
├── model/           # Domain models & DTOs
│   ├── entity/      # Cassandra entities
│   └── dto/         # Data Transfer Objects
├── security/        # Security & authentication
├── websocket/       # WebSocket handlers & events
├── kafka/           # Kafka producers & consumers
└── util/            # Utility classes
```

### Best Practices

1. **Use Lombok annotations** to reduce boilerplate:
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageDto {
    private UUID messageId;
    private String content;
}
```

2. **Use SLF4J for logging**:
```java
@Slf4j
public class MessageService {
    public void sendMessage() {
        log.info("Sending message...");
        log.debug("Message details: {}", message);
        log.error("Error occurred: {}", e.getMessage(), e);
    }
}
```

3. **Handle exceptions properly**:
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<?> handleNotFound(NotFoundException e) {
        return ResponseEntity.status(404).body(
            ErrorResponse.builder()
                .message(e.getMessage())
                .timestamp(Instant.now())
                .build()
        );
    }
}
```

4. **Use Optional for nullable returns**:
```java
public Optional<User> findById(UUID userId) {
    return userRepository.findById(userId);
}
```

5. **Validate input parameters**:
```java
public void sendMessage(@NotNull UUID conversationId, 
                       @NotBlank String content) {
    // Method implementation
}
```

---

## 📝 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(message): add message forwarding functionality

- Add forward message endpoint
- Implement forwarding logic in service layer
- Add tests for message forwarding

Closes #123
```

```bash
fix(websocket): resolve typing indicator stuck issue

- Clear typing status on disconnect
- Add proper cleanup in Redis
- Update TTL to 2 seconds

Fixes #456
```

```bash
docs(readme): update API documentation

- Add new WebSocket endpoints
- Update authentication examples
- Fix typos in configuration section
```

### Commit Message Rules

- Use imperative mood ("add" not "added")
- First line should be ≤ 50 characters
- Body should wrap at 72 characters
- Reference issues and PRs in footer

---

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] New features have tests
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] No merge conflicts with main branch

### PR Title Format

```
[Type] Brief description of changes
```

Examples:
- `[Feature] Add voice calling support`
- `[Bugfix] Fix message delivery race condition`
- `[Refactor] Optimize message service layer`

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
```

### Review Process

1. At least one maintainer must approve
2. All CI checks must pass
3. No unresolved conversations
4. Up-to-date with main branch

---

## 🧪 Testing Guidelines

### Test Structure

```java
@SpringBootTest
class MessageServiceTest {
    
    @Autowired
    private MessageService messageService;
    
    @MockBean
    private MessageRepository messageRepository;
    
    @Test
    @DisplayName("Should send message successfully")
    void shouldSendMessageSuccessfully() {
        // Arrange
        UUID conversationId = UUID.randomUUID();
        String content = "Test message";
        
        // Act
        MessageDto result = messageService.sendMessage(conversationId, content);
        
        // Assert
        assertNotNull(result);
        assertEquals(content, result.getContent());
        verify(messageRepository, times(1)).save(any());
    }
}
```

### Test Coverage Goals

- **Minimum**: 70% overall coverage
- **Target**: 80% overall coverage
- **Critical paths**: 90%+ coverage

### Running Tests

```bash
# All tests
./mvnw test

# Specific test class
./mvnw test -Dtest=MessageServiceTest

# With coverage report
./mvnw test jacoco:report

# Integration tests only
./mvnw verify -P integration-tests
```

---

## 📚 Documentation

### Code Documentation

- Add JavaDoc for public APIs
- Document complex algorithms
- Explain non-obvious decisions
- Add TODO comments for future improvements

Example:
```java
/**
 * Sends a message to a conversation with immediate echo and async processing.
 * 
 * @param conversationId The UUID of the target conversation
 * @param content The message content
 * @param senderId The UUID of the sender
 * @return MessageResponseDto containing the sent message details
 * @throws NotFoundException if conversation doesn't exist
 * @throws ForbiddenException if user is not a member of the conversation
 */
public MessageResponseDto sendMessage(UUID conversationId, String content, UUID senderId) {
    // Implementation
}
```

### API Documentation

- Document all REST endpoints
- Document WebSocket endpoints
- Include request/response examples
- Document error responses

### Update Documentation

When adding features, update:
- [ ] README.md
- [ ] API documentation in `/docs`
- [ ] Code comments
- [ ] ROADMAP.md (if applicable)

---

## 🆘 Getting Help

### Questions?

- Open a [GitHub Discussion](https://github.com/CaoNhatLinh/NovaChat-backend/discussions)
- Check existing [Issues](https://github.com/CaoNhatLinh/NovaChat-backend/issues)
- Read the [Documentation](./docs)

### Found a Bug?

1. Check if it's already reported
2. Create a new issue with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Screenshots/logs if applicable

### Want a Feature?

1. Check [ROADMAP.md](./ROADMAP.md)
2. Open a feature request issue
3. Discuss with maintainers
4. Wait for approval before implementing

---

## 🎉 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in commit history

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

**Thank you for contributing to NovaChat Backend!** 🚀
