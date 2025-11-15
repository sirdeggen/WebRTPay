# Contributing to WebRTPay

Thank you for your interest in contributing to WebRTPay! This guide will help you get started.

## Code of Conduct

Be respectful, constructive, and professional. We're all here to build something great together.

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/webrtpay.git
cd webrtpay

# Add upstream remote
git remote add upstream https://github.com/original/webrtpay.git
```

### 2. Set Up Development Environment

```bash
# Quick setup
make quickstart

# Or manually
npm install
cd demo && npm install && cd ..
docker-compose up -d coturn
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

## Development Workflow

### Running the Demo

```bash
# Start TURN server and demo
make dev-with-turn

# Or separately
make turn-up
make dev
```

### Making Changes

1. **Edit code** in `src/` directory
2. **Test changes** in the demo app
3. **Check types**: `make type-check`
4. **Run linter**: `make lint`
5. **Build**: `make build`

### Project Structure

```
src/
├── core/              # Core WebRTC functionality
│   ├── types.ts           # Type definitions
│   ├── WebRTCConnection.ts # Low-level WebRTC
│   └── ConnectionManager.ts # High-level API
├── bootstrap/         # Connection establishment
│   ├── QRBootstrap.ts     # QR code handling
│   └── RemoteBootstrap.ts # Remote services
├── protocol/          # Message handling
│   └── MessageProtocol.ts
└── utils/            # Helper functions
    └── helpers.ts
```

## Contribution Areas

### 🐛 Bug Fixes

1. **Create an issue** describing the bug
2. **Reference the issue** in your commit/PR
3. **Add tests** if possible
4. **Include reproduction steps** in PR description

### ✨ New Features

Before starting:
1. **Open an issue** to discuss the feature
2. **Wait for feedback** from maintainers
3. **Ensure alignment** with project goals

Then:
1. **Implement the feature**
2. **Add documentation** (README, EXAMPLES.md)
3. **Add TypeScript types**
4. **Update CHANGELOG.md**

### 📚 Documentation

- Fix typos, improve clarity
- Add examples
- Update API documentation
- Write guides or tutorials

### 🧪 Testing

We currently lack comprehensive tests. Contributions here are highly valued!

**Priority areas:**
- Unit tests for core classes
- Integration tests for connection flows
- Browser compatibility tests
- Mobile WebView tests

## Code Style Guidelines

### TypeScript

```typescript
// Use explicit types
function processMessage(message: PaymentMessage): void {
  // Implementation
}

// Use interfaces for objects
interface ConnectionConfig {
  timeout: number;
  retries: number;
}

// Use enums for constants
enum ConnectionState {
  IDLE = 'idle',
  CONNECTED = 'connected'
}

// Document public APIs
/**
 * Creates a new WebRTC connection
 * @param config - Connection configuration
 * @returns Promise resolving to connection instance
 */
export async function createConnection(
  config: ConnectionConfig
): Promise<Connection> {
  // Implementation
}
```

### Naming Conventions

- **Classes**: PascalCase (`WebRTCConnection`, `MessageProtocol`)
- **Functions**: camelCase (`createConnection`, `sendMessage`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- **Interfaces**: PascalCase with `I` prefix for internal (`IConfig`)
- **Types**: PascalCase (`ConnectionState`, `BootstrapToken`)
- **Files**: PascalCase for classes, camelCase for utilities

### Code Organization

- **One class per file** (except closely related types)
- **Export from index.ts** for public API
- **Keep functions small** (<50 lines ideally)
- **Minimize dependencies** between modules
- **Prefer composition** over inheritance

### Comments

```typescript
// Good: Explain WHY, not WHAT
// Wait for ICE gathering to prevent incomplete candidates
await waitForICEGathering(pc);

// Bad: Explain obvious things
// Call the function
await someFunction();

// Good: Document complex logic
/**
 * Implements exponential backoff retry logic.
 * Delay doubles on each retry: 1s, 2s, 4s, 8s...
 * Maximum delay capped at 30 seconds.
 */
function retry() { }
```

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(qr): add SVG QR code generation

Add generateQRCodeSVG method to QRBootstrap class
for vector graphics support in web applications.

Closes #42
```

```
fix(connection): handle ICE restart on connection failure

Previously, failed connections would not attempt ICE restart.
Now automatically triggers ICE restart before full retry.

Fixes #38
```

### Commit Best Practices

- **One logical change per commit**
- **Write clear commit messages**
- **Reference issues** when applicable
- **Keep commits atomic** (can be reverted independently)

## Pull Request Process

### Before Submitting

- [ ] Code builds without errors: `make build`
- [ ] Types check: `make type-check`
- [ ] Demo works: `make dev`
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (for significant changes)

### Submitting PR

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create pull request** on GitHub

3. **Fill out PR template**:
   - Description of changes
   - Motivation and context
   - Testing performed
   - Screenshots (if UI changes)
   - Related issues

4. **Wait for review**

### PR Template

```markdown
## Description
Brief description of changes

## Motivation
Why is this change needed?

## Changes
- Change 1
- Change 2

## Testing
How was this tested?

## Screenshots (if applicable)

## Checklist
- [ ] Code builds
- [ ] Types check
- [ ] Documentation updated
- [ ] Tested manually
- [ ] No breaking changes (or documented)

## Related Issues
Closes #123
```

## Review Process

### For Contributors

- **Respond to feedback** constructively
- **Make requested changes** in new commits
- **Ask questions** if unclear
- **Be patient** - reviews take time

### For Reviewers

- **Be kind and constructive**
- **Explain reasoning** for requested changes
- **Suggest alternatives** when rejecting
- **Approve when ready**

## Testing Your Changes

### Manual Testing

1. **Run the demo**: `make dev`
2. **Test in multiple browsers**: Chrome, Firefox, Safari
3. **Test on mobile devices**: iOS Safari, Android Chrome
4. **Test with TURN server**: `make turn-up`
5. **Test error conditions**: Disconnect, timeout, invalid input

### Test Cases to Consider

**Connection establishment:**
- QR code generation and scanning
- Remote username lookup
- STUN-only connection
- TURN fallback
- Connection timeout
- Network disconnection

**Message exchange:**
- Send/receive messages
- Message validation
- Schema enforcement
- Large messages
- Rapid message sending
- Connection loss during send

**Error handling:**
- Invalid QR codes
- Expired tokens
- Failed ICE negotiation
- TURN server unavailable
- Message send failure

## Documentation Standards

### README.md Updates

When adding features:
1. Update feature list
2. Add API documentation
3. Include code examples
4. Update configuration section

### EXAMPLES.md

Add comprehensive examples showing:
- Basic usage
- Common patterns
- Error handling
- Edge cases

### Code Documentation

Document all public APIs:

```typescript
/**
 * Establishes WebRTC connection using bootstrap token
 *
 * @param token - Bootstrap token from QR code or remote lookup
 * @param timeout - Optional connection timeout in milliseconds
 * @returns Promise that resolves when connection is established
 * @throws {WebRTPayError} If connection fails or times out
 *
 * @example
 * ```typescript
 * const token = await scanQRCode();
 * await manager.connectWithToken(token, 30000);
 * ```
 */
async function connectWithToken(
  token: BootstrapToken,
  timeout?: number
): Promise<void>
```

## Adding New Features

### Feature Checklist

- [ ] Implementation in `src/`
- [ ] TypeScript types defined
- [ ] Exported from `src/index.ts`
- [ ] Documentation in README.md
- [ ] Examples in EXAMPLES.md
- [ ] Demo updated (if applicable)
- [ ] CHANGELOG.md entry
- [ ] Tests (when test framework is set up)

### API Design Principles

1. **Keep it simple** - Easy to use correctly, hard to use incorrectly
2. **Consistent naming** - Follow existing conventions
3. **Type safety** - Leverage TypeScript fully
4. **Error handling** - Clear, actionable errors
5. **Backward compatibility** - Don't break existing code

## Common Tasks

### Adding a New Message Type

1. **Define the type** in `src/core/types.ts`:
```typescript
export const PaymentMessageTypes = {
  // ... existing types
  NEW_TYPE: 'new_type'
} as const;
```

2. **Register schema** in `src/protocol/MessageProtocol.ts`:
```typescript
protocol.registerSchema({
  type: 'new_type',
  requiredFields: ['field1', 'field2'],
  validate: (payload) => validateNewType(payload)
});
```

3. **Document** in EXAMPLES.md
4. **Add to demo** (optional)

### Adding a New Bootstrap Method

1. **Create new file** in `src/bootstrap/`
2. **Implement bootstrap interface**:
```typescript
export class NewBootstrap {
  async createToken(): Promise<BootstrapToken> { }
  async connect(token: BootstrapToken): Promise<void> { }
}
```

3. **Integrate** with ConnectionManager
4. **Document** thoroughly
5. **Add examples**

### Extending ConnectionManager

1. **Add method** to `src/core/ConnectionManager.ts`
2. **Update types** if needed
3. **Export** from `src/index.ts`
4. **Document** in README.md
5. **Add example** in EXAMPLES.md

## Release Process

(For maintainers)

1. **Update version** in `package.json`
2. **Update CHANGELOG.md**
3. **Create git tag**: `git tag v1.0.0`
4. **Push tag**: `git push --tags`
5. **Build**: `make build`
6. **Publish**: `npm publish`
7. **Create GitHub release**

## Getting Help

- **GitHub Issues** - Report bugs, request features
- **GitHub Discussions** - Ask questions, share ideas
- **Discord** - Real-time chat with community
- **Email** - support@webrtpay.dev

## Resources

- [WebRTC Documentation](https://webrtc.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Coturn Documentation](https://github.com/coturn/coturn)

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in documentation

Thank you for contributing to WebRTPay! 🎉

---

**Questions?** Open an issue or discussion on GitHub.
