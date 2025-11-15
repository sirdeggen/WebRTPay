# Getting Started with WebRTPay

Quick start guide to get WebRTPay up and running in your project.

## Prerequisites

- Node.js 16+ and npm/yarn
- Modern browser with WebRTC support
- Basic understanding of WebRTC concepts (helpful but not required)

## Installation

### 1. Install the Package

```bash
npm install webrtpay
```

Or with yarn:

```bash
yarn add webrtpay
```

### 2. For TypeScript Projects

WebRTPay is written in TypeScript and includes full type definitions. No additional `@types` packages needed.

```typescript
import { createConnectionManager } from 'webrtpay';
```

### 3. For JavaScript Projects

Works seamlessly with JavaScript:

```javascript
const { createConnectionManager } = require('webrtpay');
```

## Basic Usage

### Scenario 1: Face-to-Face Payment (QR Code)

Perfect for in-person transactions like coffee shops, street vendors, etc.

**Merchant Device (generates QR):**

```typescript
import { createConnectionManager, PaymentMessageTypes } from 'webrtpay';

// 1. Create connection manager
const manager = createConnectionManager();

// 2. Generate QR code
const { qrCodeDataUrl } = await manager.createQRConnection();

// 3. Display QR code
document.getElementById('qr-image').src = qrCodeDataUrl;

// 4. Listen for payment messages
manager.onMessage(PaymentMessageTypes.PAYMENT_RESPONSE, (message) => {
  if (message.payload.status === 'approved') {
    console.log('Payment received!');
  }
});

// 5. Send payment request when connected
manager.getConnection().on('stateChange', async ({ state }) => {
  if (state === 'connected') {
    await manager.send(PaymentMessageTypes.PAYMENT_REQUEST, {
      amount: 5.00,
      currency: 'USD',
      merchant: 'Coffee Shop'
    });
  }
});
```

**Customer Device (scans QR):**

```typescript
import { createConnectionManager, QRBootstrap, PaymentMessageTypes } from 'webrtpay';

// 1. Create connection manager
const manager = createConnectionManager();

// 2. Setup camera
const { video, stream } = await QRBootstrap.setupCamera('environment');
document.body.appendChild(video);

// 3. Scan and connect
await manager.scanAndJoin(video);

// 4. Cleanup camera
QRBootstrap.stopCamera(stream);
document.body.removeChild(video);

// 5. Handle payment request
manager.onMessage(PaymentMessageTypes.PAYMENT_REQUEST, async (message) => {
  const { amount, currency, merchant } = message.payload;

  // Show confirmation
  const confirmed = confirm(`Pay ${amount} ${currency} to ${merchant}?`);

  if (confirmed) {
    // Process payment and respond
    await manager.send(PaymentMessageTypes.PAYMENT_RESPONSE, {
      status: 'approved',
      transactionId: 'txn_' + Date.now()
    });
  }
});
```

### Scenario 2: Remote Payment (Username Lookup)

Perfect for sending money to friends, online purchases, etc.

**Important:** Requires running broadcaster and lookup services (see [Remote Services Setup](#remote-services-setup)).

**Sender Device:**

```typescript
import { createConnectionManager, PaymentMessageTypes } from 'webrtpay';

const manager = createConnectionManager({
  remote: {
    broadcasterUrl: 'https://your-broadcaster.example.com',
    lookupUrl: 'https://your-lookup.example.com'
  }
});

// Connect to recipient by username
await manager.joinRemoteConnection('recipient_username');

// Send payment
await manager.send(PaymentMessageTypes.PAYMENT_REQUEST, {
  amount: 25.00,
  currency: 'USD',
  description: 'Dinner split'
});
```

**Recipient Device:**

```typescript
import { createConnectionManager, PaymentMessageTypes } from 'webrtpay';

const manager = createConnectionManager({
  remote: {
    broadcasterUrl: 'https://your-broadcaster.example.com',
    lookupUrl: 'https://your-lookup.example.com'
  }
});

// Publish connection with username
await manager.publishRemoteConnection('recipient_username');

// Handle incoming payment
manager.onMessage(PaymentMessageTypes.PAYMENT_REQUEST, async (message) => {
  // Process and respond
  await manager.send(PaymentMessageTypes.PAYMENT_RESPONSE, {
    status: 'approved',
    transactionId: 'txn_' + Date.now()
  });
});
```

## Configuration

### Basic Configuration

```typescript
const manager = createConnectionManager({
  connectionTimeout: 30000,    // 30 seconds
  autoRetry: true,             // Retry on failure
  maxRetries: 3                // Max retry attempts
});
```

### Custom STUN/TURN Servers

For production, configure your own TURN servers:

```typescript
const manager = createConnectionManager({
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:your-turn-server.com:3478',
        username: 'turnuser',
        credential: 'turnpass'
      }
    ]
  }
});
```

**Why TURN servers?**
- Some networks block P2P connections
- TURN servers relay traffic when direct connection fails
- Essential for production deployment

**Where to get TURN servers:**
- [Twilio TURN](https://www.twilio.com/stun-turn)
- [Xirsys](https://xirsys.com/)
- Self-hosted: [coturn](https://github.com/coturn/coturn)

## Testing the Demo

WebRTPay includes a full-featured React demo application and a local TURN server.

### Quick Start (Recommended)

Using the Makefile for convenience:

```bash
# Clone the repository
git clone https://github.com/yourusername/webrtpay.git
cd webrtpay

# One command to set everything up
make quickstart

# Then start development
make dev
```

### Manual Setup

If you prefer to run commands manually:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/webrtpay.git
cd webrtpay

# 2. Install dependencies
npm install
cd demo && npm install && cd ..

# 3. Start local TURN server (optional but recommended)
docker-compose up -d coturn

# 4. Run the demo
cd demo
npm run dev
```

Open http://localhost:3000 in two browser tabs or on two devices.

### Available Make Commands

```bash
make help          # Show all available commands
make dev           # Run demo
make turn-up       # Start TURN server
make turn-down     # Stop TURN server
make turn-logs     # View TURN logs
make docker-up     # Start everything
make clean         # Clean build artifacts
```

### 4. Test Connection

**Tab 1:**
1. Click "Create"
2. Click "Generate QR Code"
3. QR code appears

**Tab 2:**
1. Click "Join"
2. Click "Start Camera"
3. Point camera at QR code on Tab 1
4. Connection establishes automatically

**Both Tabs:**
- Type messages and click "Send Message"
- Click "Send Test Payment" to send structured payment message
- Watch messages appear in real-time

## Mobile WebView Integration

### iOS (Swift/WKWebView)

```swift
import WebKit

class ViewController: UIViewController {
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: view.bounds, configuration: config)
        view.addSubview(webView)

        // Load your web app
        let url = URL(string: "https://your-app.com")!
        webView.load(URLRequest(url: url))
    }
}
```

**Info.plist:**
```xml
<key>NSCameraUsageDescription</key>
<string>Camera access needed for QR scanning</string>
```

### Android (Java/WebView)

```java
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }
        });

        webView.loadUrl("https://your-app.com");
        setContentView(webView);
    }
}
```

**AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
```

## Remote Services Setup

For remote username-based connections, you need to implement two services:

### Topic Broadcaster Service

Allows users to publish their connection tokens.

**Required Endpoints:**

```
POST /publish
  Body: { username: string, token: BootstrapToken, ttl: number }
  Response: { tokenId: string, expiresAt: number }

DELETE /publish?username=<username>
  Response: { success: boolean }

GET /health
  Response: { status: "ok" }
```

**Example (Node.js/Express):**

```javascript
const express = require('express');
const app = express();

const tokens = new Map(); // In production, use Redis

app.post('/publish', (req, res) => {
  const { username, token, ttl } = req.body;
  const expiresAt = Date.now() + ttl;

  tokens.set(username, { token, expiresAt });

  // Auto-cleanup after TTL
  setTimeout(() => tokens.delete(username), ttl);

  res.json({ tokenId: username, expiresAt });
});

app.delete('/publish', (req, res) => {
  const { username } = req.query;
  tokens.delete(username);
  res.json({ success: true });
});

app.listen(3001);
```

### Lookup Resolver Service

Allows users to find published connection tokens.

**Required Endpoints:**

```
GET /lookup?username=<username>
  Response: { token: BootstrapToken, username: string, publishedAt: number }

GET /health
  Response: { status: "ok" }
```

**Example (Node.js/Express):**

```javascript
app.get('/lookup', (req, res) => {
  const { username } = req.query;
  const record = tokens.get(username);

  if (!record || Date.now() > record.expiresAt) {
    return res.status(404).json({ found: false });
  }

  res.json({
    token: record.token,
    username,
    publishedAt: record.expiresAt - 300000 // TTL was 5 min
  });
});

app.listen(3002);
```

## Troubleshooting

### Connection Not Establishing

**Problem:** Connection state stays in "connecting" or goes to "failed"

**Solutions:**
1. Check browser WebRTC support: `isWebRTCSupported()`
2. Verify STUN/TURN server configuration
3. Check network/firewall settings
4. Try forcing TURN relay: `iceTransportPolicy: 'relay'`
5. Check browser console for errors

### QR Code Not Scanning

**Problem:** Camera shows but QR code isn't detected

**Solutions:**
1. Ensure camera permissions granted
2. Check lighting conditions (not too dark/bright)
3. Hold camera steady, 10-30cm from QR code
4. Try different camera: `setupCamera('user')` vs `setupCamera('environment')`
5. Test QR code works: use phone's native camera app

### Messages Not Being Received

**Problem:** Connection established but messages not arriving

**Solutions:**
1. Check connection state: `manager.isReady()`
2. Verify data channel is open (check console logs)
3. Check message schema validation
4. Look for errors in `ConnectionEvent.ERROR` handler
5. Check message is valid JSON

### Remote Service Not Working

**Problem:** Username lookup fails

**Solutions:**
1. Check service URLs are correct
2. Verify services are running: `manager.getRemoteBootstrap().checkHealth()`
3. Check CORS configuration on services
4. Verify token hasn't expired
5. Check network connectivity to services

## Next Steps

- Read the [full API documentation](README.md)
- Explore [code examples](EXAMPLES.md)
- Review the [technical specification](SPECIFICATION.md)
- Check out the demo app in `/demo`
- Join the community (Discord/GitHub)

## Common Patterns

### Connection Lifecycle Management

```typescript
import { createConnectionManager, ConnectionState } from 'webrtpay';

class PaymentSession {
  private manager = createConnectionManager();

  async start() {
    const { qrCodeDataUrl } = await this.manager.createQRConnection();
    return qrCodeDataUrl;
  }

  async waitForConnection(timeoutMs = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeoutMs);

      this.manager.getConnection().on('stateChange', ({ state }) => {
        if (state === ConnectionState.CONNECTED) {
          clearTimeout(timeout);
          resolve();
        } else if (state === ConnectionState.FAILED) {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        }
      });
    });
  }

  async cleanup() {
    this.manager.close();
  }
}
```

### Message Request/Response Pattern

```typescript
async function sendAndWaitForResponse(
  manager: ConnectionManager,
  requestType: string,
  requestPayload: any,
  responseType: string,
  timeoutMs = 30000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      manager.offMessage(responseType, handler);
      reject(new Error('Response timeout'));
    }, timeoutMs);

    const handler = (message: PaymentMessage) => {
      clearTimeout(timeout);
      manager.offMessage(responseType, handler);
      resolve(message.payload);
    };

    manager.onMessage(responseType, handler);
    manager.send(requestType, requestPayload);
  });
}

// Usage
const response = await sendAndWaitForResponse(
  manager,
  'payment_request',
  { amount: 100 },
  'payment_response',
  30000
);
```

## Support

Need help? Here's how to get support:

1. **Documentation:** Check README.md and EXAMPLES.md
2. **GitHub Issues:** Report bugs or request features
3. **Discussions:** Ask questions in GitHub Discussions
4. **Discord:** Join our community server
5. **Stack Overflow:** Tag questions with `webrtpay`

Happy coding!
