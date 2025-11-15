# WebRTPay

A mobile-to-mobile WebRTC connection system for secure, peer-to-peer payment interactions. Built for web applications rendered in mobile WebView containers (iOS and Android) and standard mobile browsers.

## Features

- **WebRTC Data Channels**: Direct peer-to-peer communication
- **QR Code Bootstrapping**: Quick local connection via QR code scanning
- **Remote Bootstrapping**: Connect via username lookup with Topic Broadcaster and Lookup Resolver services
- **STUN/TURN Support**: Automatic NAT traversal with fallback relay
- **JSON Message Protocol**: Structured message validation and routing
- **TypeScript**: Full type safety and IntelliSense support
- **Mobile-Optimized**: Designed for mobile WebView and browser environments

## Installation

```bash
npm install webrtpay
```

Or with yarn:

```bash
yarn add webrtpay
```

## Quick Start

### 1. Create a Connection (Device A)

```typescript
import { createConnectionManager } from 'webrtpay';

// Initialize connection manager
const manager = createConnectionManager({
  connectionTimeout: 30000,
  autoRetry: true,
  maxRetries: 3
});

// Generate QR code for local connection
const { qrCodeDataUrl, token } = await manager.createQRConnection();

// Display QR code
document.getElementById('qr-image').src = qrCodeDataUrl;
```

### 2. Join Connection (Device B)

```typescript
import { createConnectionManager, QRBootstrap } from 'webrtpay';

const manager = createConnectionManager();

// Setup camera for scanning
const { video, stream } = await QRBootstrap.setupCamera('environment');

// Scan and join
await manager.scanAndJoin(video);

// Stop camera after successful connection
QRBootstrap.stopCamera(stream);
```

### 3. Exchange Messages

```typescript
import { PaymentMessageTypes } from 'webrtpay';

// Listen for messages
manager.onMessage(PaymentMessageTypes.PAYMENT_REQUEST, (message) => {
  console.log('Payment request:', message.payload);
});

// Send a message
await manager.send(PaymentMessageTypes.PAYMENT_REQUEST, {
  amount: 50.00,
  currency: 'USD',
  recipient: 'user123',
  description: 'Coffee payment'
});
```

## Connection Methods

### QR Code (Local)

Best for face-to-face payments:

```typescript
// Device A: Create QR code
const { qrCodeDataUrl } = await manager.createQRConnection();

// Device B: Scan QR code
const token = await QRBootstrap.scanQRCodeFromVideo(videoElement);
await manager.joinQRConnection(token);
```

### Remote Lookup

Best for remote payments:

```typescript
// Configure remote services
const manager = createConnectionManager({
  remote: {
    broadcasterUrl: 'https://broadcaster.example.com',
    lookupUrl: 'https://lookup.example.com',
    tokenValidityMs: 300000 // 5 minutes
  }
});

// Device A: Publish connection
await manager.publishRemoteConnection('alice');

// Device B: Lookup and connect
await manager.joinRemoteConnection('alice');
```

## Message Protocol

### Built-in Message Types

```typescript
import { PaymentMessageTypes } from 'webrtpay';

// Available types:
PaymentMessageTypes.PAYMENT_REQUEST
PaymentMessageTypes.PAYMENT_RESPONSE
PaymentMessageTypes.PAYMENT_ACKNOWLEDGMENT
PaymentMessageTypes.ERROR
PaymentMessageTypes.HANDSHAKE
PaymentMessageTypes.PING
PaymentMessageTypes.PONG
```

### Custom Message Schemas

```typescript
import { MessageProtocol } from 'webrtpay';

const protocol = manager.getProtocol();

// Register custom schema
protocol.registerSchema({
  type: 'custom_payment',
  requiredFields: ['amount', 'token'],
  validate: (payload) => {
    return payload.amount > 0;
  }
});

// Send custom message
await manager.send('custom_payment', {
  amount: 100,
  token: 'abc123'
});
```

## API Reference

### ConnectionManager

Main class for managing WebRTC connections.

#### Constructor

```typescript
const manager = createConnectionManager(config?: ConnectionManagerConfig);
```

**ConnectionManagerConfig:**
- `webrtc?: WebRTCConfig` - WebRTC configuration (ICE servers, etc.)
- `remote?: RemoteBootstrapConfig` - Remote service configuration
- `connectionTimeout?: number` - Connection timeout in ms (default: 30000)
- `autoRetry?: boolean` - Enable automatic retry (default: true)
- `maxRetries?: number` - Maximum retry attempts (default: 3)

#### Methods

**Connection Management:**
- `createQRConnection()` - Create connection and generate QR code
- `joinQRConnection(token)` - Join using bootstrap token
- `scanAndJoin(video, timeout?)` - Scan QR and join automatically
- `publishRemoteConnection(username)` - Publish to remote broadcaster
- `joinRemoteConnection(username)` - Lookup and join remote connection

**Messaging:**
- `send(type, payload)` - Create and send message
- `sendMessage(message)` - Send pre-created message
- `onMessage(type, handler)` - Register message handler
- `offMessage(type, handler)` - Unregister message handler
- `onAnyMessage(handler)` - Handle all message types

**State & Info:**
- `getState()` - Get current connection state
- `isReady()` - Check if ready for messaging
- `getConnectionId()` - Get unique connection ID
- `getMessageHistory(type?)` - Get message history
- `getStats()` - Get connection statistics
- `close()` - Close connection and cleanup

### QRBootstrap

Utilities for QR code generation and scanning.

#### Methods

- `generateQRCode(token, options?)` - Generate QR code as data URL
- `generateQRCodeSVG(token, options?)` - Generate QR code as SVG
- `scanQRCode(imageData)` - Scan QR from ImageData
- `scanQRCodeFromVideo(video, timeout?)` - Continuous video scanning
- `setupCamera(facingMode?)` - Setup camera for scanning
- `stopCamera(stream)` - Stop camera stream
- `validateToken(token)` - Validate token structure
- `isTokenExpired(token, maxAge?)` - Check token expiration

### ConnectionState

```typescript
enum ConnectionState {
  IDLE = 'idle',
  CREATING_OFFER = 'creating_offer',
  AWAITING_ANSWER = 'awaiting_answer',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  CLOSED = 'closed'
}
```

## Configuration

### STUN/TURN Servers

```typescript
import { createConnectionManager } from 'webrtpay';

const manager = createConnectionManager({
  webrtc: {
    iceServers: [
      // Public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },

      // Your TURN server
      {
        urls: 'turn:turn.example.com:3478',
        username: 'user',
        credential: 'password'
      }
    ],
    iceTransportPolicy: 'all', // or 'relay' to force TURN
    bundlePolicy: 'balanced'
  }
});
```

### Remote Services

To use remote bootstrapping, you need to implement two services:

**Topic Broadcaster API:**
```
POST /publish
Body: { username: string, token: BootstrapToken, ttl: number }
Response: { tokenId: string, expiresAt: number }

DELETE /publish?username=<username>
Response: { success: boolean }
```

**Lookup Resolver API:**
```
GET /lookup?username=<username>
Response: { token: BootstrapToken, username: string, publishedAt: number }
```

## Error Handling

```typescript
import { WebRTPayError, ErrorType } from 'webrtpay';

try {
  await manager.createQRConnection();
} catch (error) {
  if (error instanceof WebRTPayError) {
    switch (error.type) {
      case ErrorType.BOOTSTRAP_GENERATION_FAILED:
        console.error('Failed to generate bootstrap token');
        break;
      case ErrorType.CONNECTION_FAILED:
        console.error('WebRTC connection failed');
        break;
      case ErrorType.ICE_FAILED:
        console.error('ICE negotiation failed');
        break;
      case ErrorType.TIMEOUT:
        console.error('Operation timed out');
        break;
      // ... handle other error types
    }
  }
}
```

## Mobile WebView Integration

### iOS (WKWebView)

```swift
import WebKit

let webView = WKWebView()
let config = webView.configuration

// Enable camera access
config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
config.mediaTypesRequiringUserActionForPlayback = []
```

### Android (WebView)

```java
WebView webView = new WebView(this);
WebSettings settings = webView.getSettings();

settings.setJavaScriptEnabled(true);
settings.setDomStorageEnabled(true);
settings.setMediaPlaybackRequiresUserGesture(false);

// Enable camera permission
webView.setWebChromeClient(new WebChromeClient() {
    @Override
    public void onPermissionRequest(PermissionRequest request) {
        request.grant(request.getResources());
    }
});
```

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14.1+
- Mobile Chrome (Android)
- Mobile Safari (iOS 14.3+)

WebRTC is supported in all modern browsers. Check compatibility:

```typescript
import { isWebRTCSupported } from 'webrtpay';

if (!isWebRTCSupported()) {
  alert('WebRTC is not supported in this browser');
}
```

## Security

- All WebRTC connections use DTLS-SRTP encryption
- Bootstrap tokens should have short TTL (5 minutes recommended)
- Token publication does not authorize payments, only communication
- Implement additional authentication in your payment flow
- Validate all incoming messages before processing

## Examples

See the `/demo` directory for a complete React application demonstrating:
- QR code generation and scanning
- Remote username-based connections
- Message exchange
- Connection state management
- Error handling

Run the demo:

```bash
cd demo
npm install
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────┐
│        ConnectionManager                │
│  (High-level orchestration)             │
└────────────┬────────────────────────────┘
             │
    ┌────────┴─────────┐
    │                  │
┌───▼──────────┐  ┌───▼─────────────┐
│ WebRTC       │  │ MessageProtocol │
│ Connection   │  │                 │
└──────┬───────┘  └─────────────────┘
       │
┌──────┴──────────────────┐
│                         │
│  ┌──────────────────┐  │
│  │  QRBootstrap     │  │
│  └──────────────────┘  │
│                         │
│  ┌──────────────────┐  │
│  │ RemoteBootstrap  │  │
│  └──────────────────┘  │
└─────────────────────────┘
```

## Performance

- QR code generation: ~100ms
- Connection establishment (STUN): ~1-3 seconds
- Connection establishment (TURN fallback): ~3-5 seconds
- Message latency: <50ms (direct P2P)
- QR code size: ~1-2KB (optimized payload)

## Troubleshooting

### Connection fails immediately

- Check STUN/TURN server configuration
- Verify network allows WebRTC traffic
- Check browser WebRTC support

### QR scan not working

- Ensure camera permissions granted
- Check lighting conditions
- Verify QR code is not too small/large
- Try different camera (front/back)

### Messages not received

- Check connection state is CONNECTED
- Verify data channel is open: `manager.isReady()`
- Check message schema validation

## License

MIT

## Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## Support

- GitHub Issues: https://github.com/yourusername/webrtpay/issues
- Documentation: https://webrtpay.dev
- Discord: https://discord.gg/webrtpay
