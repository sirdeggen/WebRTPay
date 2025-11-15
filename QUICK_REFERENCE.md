# WebRTPay Quick Reference

Fast reference for common operations and API usage.

## Installation

```bash
npm install webrtpay
```

## Import

```typescript
import {
  createConnectionManager,
  ConnectionManager,
  ConnectionState,
  ConnectionEvent,
  PaymentMessageTypes,
  QRBootstrap,
  RemoteBootstrap,
  WebRTPayError,
  ErrorType
} from 'webrtpay';
```

## Quick Start

### Create Connection Manager

```typescript
const manager = createConnectionManager({
  connectionTimeout: 30000,
  autoRetry: true,
  maxRetries: 3
});
```

### QR Code Connection

```typescript
// Device A: Generate QR
const { qrCodeDataUrl } = await manager.createQRConnection();

// Device B: Scan and join
await manager.scanAndJoin(videoElement);
```

### Remote Connection

```typescript
// Device A: Publish
await manager.publishRemoteConnection('alice');

// Device B: Join
await manager.joinRemoteConnection('alice');
```

## Message Handling

### Send Message

```typescript
await manager.send('payment_request', {
  amount: 50.00,
  currency: 'USD',
  recipient: 'merchant123'
});
```

### Receive Messages

```typescript
// Specific type
manager.onMessage('payment_request', (message) => {
  console.log(message.payload);
});

// All messages
manager.onAnyMessage((message) => {
  console.log(message.type, message.payload);
});
```

## Event Handling

### Connection Events

```typescript
const connection = manager.getConnection();

connection.on(ConnectionEvent.STATE_CHANGE, ({ state }) => {
  console.log('State:', state);
});

connection.on(ConnectionEvent.ERROR, ({ error }) => {
  console.error('Error:', error);
});
```

## State Management

### Check Connection State

```typescript
const state = manager.getState();
const isReady = manager.isReady();
const isConnected = state === ConnectionState.CONNECTED;
```

### Connection States

- `IDLE` - Not started
- `CREATING_OFFER` - Generating offer
- `AWAITING_ANSWER` - Waiting for peer
- `CONNECTING` - ICE negotiation
- `CONNECTED` - Ready for messages
- `DISCONNECTED` - Connection lost
- `FAILED` - Connection failed
- `CLOSED` - Connection closed

## QR Bootstrap API

### Generate QR Code

```typescript
import { QRBootstrap } from 'webrtpay';

// As data URL (PNG)
const dataUrl = await QRBootstrap.generateQRCode(token);

// As SVG
const svg = await QRBootstrap.generateQRCodeSVG(token);
```

### Scan QR Code

```typescript
// From video stream
const token = await QRBootstrap.scanQRCodeFromVideo(videoElement);

// From ImageData
const token = QRBootstrap.scanQRCode(imageData);
```

### Camera Setup

```typescript
// Setup camera
const { video, stream } = await QRBootstrap.setupCamera('environment');

// Stop camera
QRBootstrap.stopCamera(stream);
```

## Remote Bootstrap API

### Create Client

```typescript
import { createRemoteBootstrap } from 'webrtpay';

const remote = createRemoteBootstrap({
  broadcasterUrl: 'https://broadcaster.example.com',
  lookupUrl: 'https://lookup.example.com',
  tokenValidityMs: 300000
});
```

### Publish Token

```typescript
const response = await remote.publishToken('username', token);
// { success: true, tokenId: '...', expiresAt: ... }
```

### Lookup Token

```typescript
const response = await remote.lookupToken('username');
// { found: true, token: {...}, username: '...', publishedAt: ... }
```

## Message Protocol API

### Register Schema

```typescript
const protocol = manager.getProtocol();

protocol.registerSchema({
  type: 'custom_type',
  requiredFields: ['field1', 'field2'],
  validate: (payload) => payload.field1 > 0
});
```

### Create Message

```typescript
const message = protocol.createMessage('custom_type', {
  field1: 100,
  field2: 'value'
});
```

### Message History

```typescript
// All messages
const history = protocol.getHistory();

// Specific type
const requests = protocol.getHistory('payment_request');

// Clear history
protocol.clearHistory();
```

## Configuration

### WebRTC Config

```typescript
{
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:turn.example.com:3478',
        username: 'user',
        credential: 'pass'
      }
    ],
    iceTransportPolicy: 'all', // or 'relay'
    bundlePolicy: 'balanced'
  }
}
```

### Remote Config

```typescript
{
  remote: {
    broadcasterUrl: 'https://broadcaster.example.com',
    lookupUrl: 'https://lookup.example.com',
    tokenValidityMs: 300000 // 5 minutes
  }
}
```

## Error Handling

### Error Types

```typescript
ErrorType.BOOTSTRAP_GENERATION_FAILED
ErrorType.BOOTSTRAP_PARSE_FAILED
ErrorType.CONNECTION_FAILED
ErrorType.ICE_FAILED
ErrorType.DATA_CHANNEL_FAILED
ErrorType.MESSAGE_SEND_FAILED
ErrorType.TIMEOUT
ErrorType.REMOTE_SERVICE_ERROR
```

### Catch Errors

```typescript
try {
  await manager.createQRConnection();
} catch (error) {
  if (error instanceof WebRTPayError) {
    console.error(error.type, error.message, error.details);
  }
}
```

## Built-in Message Types

```typescript
PaymentMessageTypes.PAYMENT_REQUEST
PaymentMessageTypes.PAYMENT_RESPONSE
PaymentMessageTypes.PAYMENT_ACKNOWLEDGMENT
PaymentMessageTypes.ERROR
PaymentMessageTypes.HANDSHAKE
PaymentMessageTypes.PING
PaymentMessageTypes.PONG
```

## Utility Functions

### Browser Detection

```typescript
import { isWebRTCSupported, isMobile, getBrowserInfo } from 'webrtpay';

if (!isWebRTCSupported()) {
  alert('WebRTC not supported');
}

const mobile = isMobile();
const info = getBrowserInfo();
```

### Helpers

```typescript
import { delay, timeout, retry, validateUsername } from 'webrtpay';

// Delay
await delay(1000);

// Timeout promise
const result = await timeout(promise, 5000, 'Timed out');

// Retry with backoff
const result = await retry(() => doSomething(), {
  maxRetries: 3,
  initialDelay: 1000
});

// Validate username
const { valid, error } = validateUsername('user123');
```

## Statistics

### Connection Stats

```typescript
const stats = await manager.getStats();

// WebRTC stats
const rtcStats = stats.connection;

// Protocol stats
const protocolStats = stats.protocol;
// { totalMessages, queuedMessages, registeredHandlers, registeredSchemas }
```

## Lifecycle

### Cleanup

```typescript
// Close connection
manager.close();

// Stop camera
QRBootstrap.stopCamera(stream);

// Clear message history
protocol.clearHistory();

// Clear message queue
protocol.clearQueue();
```

## React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { createConnectionManager } from 'webrtpay';

function useConnection() {
  const [manager, setManager] = useState(null);
  const [state, setState] = useState('idle');

  useEffect(() => {
    const mgr = createConnectionManager();
    mgr.getConnection().on('stateChange', ({ state }) => {
      setState(state);
    });
    setManager(mgr);
    return () => mgr.close();
  }, []);

  return { manager, state };
}
```

## Common Patterns

### Wait for Connection

```typescript
function waitForConnection(manager, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeoutMs);

    manager.getConnection().on('stateChange', ({ state }) => {
      if (state === 'connected') {
        clearTimeout(timer);
        resolve();
      } else if (state === 'failed') {
        clearTimeout(timer);
        reject(new Error('Connection failed'));
      }
    });
  });
}
```

### Request/Response Pattern

```typescript
async function sendRequest(manager, type, payload) {
  const messageId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Response timeout'));
    }, 30000);

    manager.onMessage('response', (message) => {
      if (message.payload.requestId === messageId) {
        clearTimeout(timeout);
        resolve(message.payload);
      }
    });

    manager.send(type, { ...payload, messageId });
  });
}
```

## Debugging

### Enable Verbose Logging

```typescript
// Connection events
manager.getConnection().on('stateChange', console.log);
manager.getConnection().on('iceCandidate', console.log);
manager.getConnection().on('error', console.error);

// All messages
manager.onAnyMessage(console.log);
```

### Check ICE Candidates

```typescript
const stats = await manager.getConnection().getStats();
for (const [id, stat] of stats.entries()) {
  if (stat.type === 'candidate-pair') {
    console.log('Candidate:', stat);
  }
}
```

## Performance Tips

1. **Reuse ConnectionManager** - Don't create multiple instances
2. **Limit History Size** - `protocol.setMaxHistorySize(50)`
3. **Clear History** - Periodically clear old messages
4. **Use TURN Only for Testing** - `iceTransportPolicy: 'relay'`
5. **Compress QR Payloads** - Minimize ICE candidates in token

## Security Best Practices

1. **Don't Store Tokens** - Use short TTL
2. **Validate Messages** - Use schema validation
3. **Additional Auth** - Token ≠ payment authorization
4. **HTTPS Only** - Serve app over HTTPS
5. **Camera Permissions** - Request explicitly

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection fails | Check TURN servers, network, firewall |
| QR won't scan | Better lighting, hold steady, check permissions |
| Messages not received | Check `isReady()`, data channel state |
| Slow connection | Check ICE candidates, use TURN |
| Remote lookup fails | Check service URLs, CORS, token expiry |

## Links

- [Full Documentation](README.md)
- [Getting Started](GETTING_STARTED.md)
- [Examples](EXAMPLES.md)
- [Specification](SPECIFICATION.md)
- [Project Summary](PROJECT_SUMMARY.md)

---

**Quick Reference v1.0.0**
