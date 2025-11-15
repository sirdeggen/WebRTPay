# WebRTPay Examples

Comprehensive examples for using WebRTPay in various scenarios.

## Table of Contents

1. [Basic QR Connection](#basic-qr-connection)
2. [Remote Username Connection](#remote-username-connection)
3. [Custom Message Types](#custom-message-types)
4. [Event Handling](#event-handling)
5. [Error Handling](#error-handling)
6. [React Integration](#react-integration)
7. [Payment Flow](#payment-flow)
8. [Advanced Configuration](#advanced-configuration)

## Basic QR Connection

### Device A: Create and Display QR Code

```typescript
import { createConnectionManager } from 'webrtpay';

async function createPaymentQR() {
  // Initialize manager
  const manager = createConnectionManager();

  // Generate QR code
  const { qrCodeDataUrl, token } = await manager.createQRConnection();

  // Display QR code
  const img = document.createElement('img');
  img.src = qrCodeDataUrl;
  document.body.appendChild(img);

  // Listen for connection
  manager.getConnection().on('stateChange', ({ state }) => {
    console.log('Connection state:', state);
    if (state === 'connected') {
      console.log('Ready to exchange messages!');
    }
  });

  // Handle incoming messages
  manager.onAnyMessage((message) => {
    console.log('Received:', message);
  });

  return manager;
}
```

### Device B: Scan QR Code and Connect

```typescript
import { createConnectionManager, QRBootstrap } from 'webrtpay';

async function scanAndConnect() {
  const manager = createConnectionManager();

  // Setup camera
  const { video, stream } = await QRBootstrap.setupCamera('environment');

  // Add video to DOM for preview
  document.body.appendChild(video);

  try {
    // Scan QR code and connect
    await manager.scanAndJoin(video, 30000);
    console.log('Connected successfully!');
  } catch (error) {
    console.error('Failed to connect:', error);
  } finally {
    // Cleanup camera
    QRBootstrap.stopCamera(stream);
    document.body.removeChild(video);
  }

  return manager;
}
```

## Remote Username Connection

### Device A: Publish Connection

```typescript
import { createConnectionManager } from 'webrtpay';

async function publishConnection(username: string) {
  const manager = createConnectionManager({
    remote: {
      broadcasterUrl: 'https://broadcaster.example.com',
      lookupUrl: 'https://lookup.example.com',
      tokenValidityMs: 300000 // 5 minutes
    }
  });

  try {
    const { publishResponse } = await manager.publishRemoteConnection(username);
    console.log('Published successfully:', publishResponse);
    console.log(`Tell the other person to connect using: ${username}`);
  } catch (error) {
    console.error('Failed to publish:', error);
  }

  return manager;
}

// Usage
const manager = await publishConnection('alice123');
```

### Device B: Lookup and Connect

```typescript
import { createConnectionManager } from 'webrtpay';

async function connectToUser(username: string) {
  const manager = createConnectionManager({
    remote: {
      broadcasterUrl: 'https://broadcaster.example.com',
      lookupUrl: 'https://lookup.example.com'
    }
  });

  try {
    await manager.joinRemoteConnection(username);
    console.log('Connected to', username);
  } catch (error) {
    console.error('Failed to connect:', error);
  }

  return manager;
}

// Usage
const manager = await connectToUser('alice123');
```

## Custom Message Types

### Define Custom Message Schema

```typescript
import { createConnectionManager, MessageProtocol } from 'webrtpay';

const manager = createConnectionManager();
const protocol = manager.getProtocol();

// Register custom message type
protocol.registerSchema({
  type: 'invoice',
  requiredFields: ['invoiceId', 'amount', 'currency', 'items'],
  validate: (payload: any) => {
    return (
      payload.amount > 0 &&
      payload.items.length > 0 &&
      ['USD', 'EUR', 'GBP'].includes(payload.currency)
    );
  }
});

// Send custom message
await manager.send('invoice', {
  invoiceId: 'INV-001',
  amount: 150.00,
  currency: 'USD',
  items: [
    { name: 'Product A', price: 100.00 },
    { name: 'Product B', price: 50.00 }
  ],
  dueDate: '2025-12-31'
});

// Handle custom message
manager.onMessage('invoice', (message) => {
  const invoice = message.payload;
  console.log('Invoice received:', invoice);

  // Process invoice
  processInvoice(invoice);
});
```

## Event Handling

### Connection Events

```typescript
import {
  createConnectionManager,
  ConnectionEvent,
  ConnectionState
} from 'webrtpay';

const manager = createConnectionManager();
const connection = manager.getConnection();

// Connection state changes
connection.on(ConnectionEvent.STATE_CHANGE, ({ state }) => {
  switch (state) {
    case ConnectionState.CONNECTING:
      showLoader('Connecting...');
      break;
    case ConnectionState.CONNECTED:
      hideLoader();
      showNotification('Connected!');
      break;
    case ConnectionState.FAILED:
      hideLoader();
      showError('Connection failed');
      break;
    case ConnectionState.DISCONNECTED:
      showNotification('Disconnected');
      break;
  }
});

// ICE candidates (for debugging)
connection.on(ConnectionEvent.ICE_CANDIDATE, ({ candidate }) => {
  console.log('ICE candidate:', candidate);
});

// Data channel opened
connection.on(ConnectionEvent.DATA_CHANNEL_OPEN, ({ channel }) => {
  console.log('Data channel ready:', channel.label);
});

// Errors
connection.on(ConnectionEvent.ERROR, ({ error }) => {
  console.error('Connection error:', error.type, error.message);
  showError(error.message);
});
```

### Message Events

```typescript
import { PaymentMessageTypes } from 'webrtpay';

// Specific message type handler
manager.onMessage(PaymentMessageTypes.PAYMENT_REQUEST, async (message) => {
  const request = message.payload;
  console.log('Payment request:', request);

  // Show confirmation dialog
  const confirmed = await showConfirmation(
    `Pay ${request.amount} ${request.currency}?`
  );

  if (confirmed) {
    // Send response
    await manager.send(PaymentMessageTypes.PAYMENT_RESPONSE, {
      transactionId: generateTransactionId(),
      status: 'approved',
      amount: request.amount,
      currency: request.currency
    });
  }
});

// Handle all messages
manager.onAnyMessage((message) => {
  console.log('Message received:', message.type, message.payload);

  // Log to analytics
  trackEvent('message_received', {
    type: message.type,
    timestamp: message.timestamp
  });
});
```

## Error Handling

### Comprehensive Error Handling

```typescript
import {
  createConnectionManager,
  WebRTPayError,
  ErrorType
} from 'webrtpay';

async function robustConnection() {
  const manager = createConnectionManager({
    autoRetry: true,
    maxRetries: 3
  });

  try {
    await manager.createQRConnection();
  } catch (error) {
    if (error instanceof WebRTPayError) {
      handleWebRTPayError(error);
    } else {
      console.error('Unexpected error:', error);
      showError('An unexpected error occurred');
    }
  }
}

function handleWebRTPayError(error: WebRTPayError) {
  switch (error.type) {
    case ErrorType.BOOTSTRAP_GENERATION_FAILED:
      showError('Failed to create connection. Please try again.');
      break;

    case ErrorType.CONNECTION_FAILED:
      showError('Connection failed. Check your internet connection.');
      break;

    case ErrorType.ICE_FAILED:
      showError(
        'Unable to establish connection. This may be due to firewall restrictions.'
      );
      break;

    case ErrorType.TIMEOUT:
      showError('Connection timed out. Please try again.');
      break;

    case ErrorType.MESSAGE_SEND_FAILED:
      showError('Failed to send message. Connection may be unstable.');
      // Message will be queued for retry
      break;

    case ErrorType.REMOTE_SERVICE_ERROR:
      showError('Remote service unavailable. Try QR code instead.');
      break;

    default:
      showError(`Error: ${error.message}`);
  }

  // Log for debugging
  console.error('WebRTPay Error:', {
    type: error.type,
    message: error.message,
    details: error.details
  });
}
```

## React Integration

### Custom Hook

```typescript
import { useState, useEffect, useCallback } from 'react';
import {
  createConnectionManager,
  ConnectionManager,
  ConnectionState,
  PaymentMessage
} from 'webrtpay';

export function useWebRTCConnection() {
  const [manager, setManager] = useState<ConnectionManager | null>(null);
  const [state, setState] = useState<ConnectionState>(ConnectionState.IDLE);
  const [messages, setMessages] = useState<PaymentMessage[]>([]);
  const [error, setError] = useState<string>('');

  // Initialize manager
  useEffect(() => {
    const mgr = createConnectionManager();

    // Setup listeners
    mgr.getConnection().on('stateChange', ({ state }) => {
      setState(state);
    });

    mgr.onAnyMessage((message) => {
      setMessages(prev => [...prev, message]);
    });

    mgr.getConnection().on('error', ({ error }) => {
      setError(error.message);
    });

    setManager(mgr);

    // Cleanup
    return () => {
      mgr.close();
    };
  }, []);

  // Create QR connection
  const createQR = useCallback(async () => {
    if (!manager) return null;

    try {
      setError('');
      return await manager.createQRConnection();
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [manager]);

  // Join connection
  const joinQR = useCallback(async (token: any) => {
    if (!manager) return;

    try {
      setError('');
      await manager.joinQRConnection(token);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [manager]);

  // Send message
  const send = useCallback(async (type: string, payload: any) => {
    if (!manager) return;

    try {
      setError('');
      await manager.send(type, payload);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [manager]);

  // Close connection
  const close = useCallback(() => {
    if (manager) {
      manager.close();
      setState(ConnectionState.IDLE);
      setMessages([]);
    }
  }, [manager]);

  return {
    state,
    messages,
    error,
    isConnected: state === ConnectionState.CONNECTED,
    createQR,
    joinQR,
    send,
    close
  };
}
```

### Usage in Component

```typescript
import React from 'react';
import { useWebRTCConnection } from './useWebRTCConnection';

function PaymentComponent() {
  const { state, messages, error, isConnected, createQR, send } =
    useWebRTCConnection();

  const [qrCode, setQrCode] = React.useState('');

  const handleCreate = async () => {
    const result = await createQR();
    if (result) {
      setQrCode(result.qrCodeDataUrl);
    }
  };

  const handlePay = async () => {
    await send('payment_request', {
      amount: 50.00,
      currency: 'USD',
      recipient: 'merchant123'
    });
  };

  return (
    <div>
      <h2>Status: {state}</h2>
      {error && <div className="error">{error}</div>}

      {!isConnected && (
        <button onClick={handleCreate}>Create Payment QR</button>
      )}

      {qrCode && <img src={qrCode} alt="QR Code" />}

      {isConnected && (
        <button onClick={handlePay}>Send Payment</button>
      )}

      <div>
        <h3>Messages</h3>
        {messages.map((msg, i) => (
          <div key={i}>{msg.type}: {JSON.stringify(msg.payload)}</div>
        ))}
      </div>
    </div>
  );
}
```

## Payment Flow

### Complete Payment Interaction

```typescript
import { createConnectionManager, PaymentMessageTypes } from 'webrtpay';

// Merchant creates payment request
async function merchantFlow() {
  const manager = createConnectionManager();

  // Create QR code
  const { qrCodeDataUrl } = await manager.createQRConnection();
  displayQRCode(qrCodeDataUrl);

  // Wait for customer to connect
  await waitForConnection(manager);

  // Send payment request
  const transactionId = generateTransactionId();
  await manager.send(PaymentMessageTypes.PAYMENT_REQUEST, {
    transactionId,
    amount: 25.00,
    currency: 'USD',
    merchant: 'Coffee Shop',
    description: 'Latte'
  });

  // Wait for payment response
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Payment timeout'));
    }, 60000);

    manager.onMessage(PaymentMessageTypes.PAYMENT_RESPONSE, (message) => {
      clearTimeout(timeout);
      const response = message.payload as any;

      if (response.status === 'approved') {
        // Send acknowledgment
        manager.send(PaymentMessageTypes.PAYMENT_ACKNOWLEDGMENT, {
          transactionId: response.transactionId,
          confirmed: true,
          receipt: generateReceipt(response)
        });

        resolve(response);
      } else {
        reject(new Error('Payment declined'));
      }
    });
  });
}

// Customer scans and pays
async function customerFlow(video: HTMLVideoElement) {
  const manager = createConnectionManager();

  // Scan QR and connect
  await manager.scanAndJoin(video);

  // Wait for payment request
  return new Promise((resolve, reject) => {
    manager.onMessage(PaymentMessageTypes.PAYMENT_REQUEST, async (message) => {
      const request = message.payload as any;

      // Show confirmation to user
      const confirmed = await showPaymentConfirmation(request);

      if (confirmed) {
        // Process payment
        const result = await processPayment(request);

        // Send response
        await manager.send(PaymentMessageTypes.PAYMENT_RESPONSE, {
          transactionId: request.transactionId,
          status: 'approved',
          amount: request.amount,
          currency: request.currency,
          paymentMethod: 'card',
          timestamp: Date.now()
        });

        // Wait for acknowledgment
        manager.onMessage(
          PaymentMessageTypes.PAYMENT_ACKNOWLEDGMENT,
          (ack) => {
            resolve(ack.payload);
          }
        );
      } else {
        await manager.send(PaymentMessageTypes.PAYMENT_RESPONSE, {
          transactionId: request.transactionId,
          status: 'declined',
          reason: 'User cancelled'
        });
        reject(new Error('User cancelled'));
      }
    });
  });
}
```

## Advanced Configuration

### Custom TURN Server Configuration

```typescript
import { createConnectionManager } from 'webrtpay';

const manager = createConnectionManager({
  webrtc: {
    iceServers: [
      // Public STUN
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },

      // Your TURN servers
      {
        urls: [
          'turn:turn1.example.com:3478',
          'turn:turn1.example.com:3478?transport=tcp'
        ],
        username: 'user1',
        credential: 'password1'
      },
      {
        urls: 'turn:turn2.example.com:3478',
        username: 'user2',
        credential: 'password2'
      }
    ],

    // Force TURN relay (for testing or privacy)
    iceTransportPolicy: 'relay', // or 'all' for normal operation

    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  },

  connectionTimeout: 45000, // 45 seconds
  autoRetry: true,
  maxRetries: 5
});
```

### Message Queue and Retry

```typescript
import { createConnectionManager } from 'webrtpay';

const manager = createConnectionManager();
const protocol = manager.getProtocol();

// Configure retry behavior
protocol.setMaxRetries(5);
protocol.setMaxHistorySize(200);

// Send messages (they'll be queued if not connected)
await manager.send('payment_request', { amount: 100 });

// Monitor queue
const queue = protocol.getQueue();
console.log('Queued messages:', queue.length);

// Manual retry
await protocol.retryQueuedMessages(
  async (message) => {
    await manager.sendMessage(message);
  }
);

// Get statistics
const stats = protocol.getStats();
console.log('Protocol stats:', stats);
```

### Connection Statistics

```typescript
import { createConnectionManager } from 'webrtpay';

const manager = createConnectionManager();

// After connection established
const stats = await manager.getStats();

// WebRTC stats
const rtcStats = stats.connection;
if (rtcStats) {
  for (const [id, stat] of rtcStats.entries()) {
    console.log('Stat:', id, stat);

    // Check specific stats
    if (stat.type === 'candidate-pair' && stat.nominated) {
      console.log('Active candidate pair:', stat);
      console.log('RTT:', stat.currentRoundTripTime);
      console.log('Bytes sent:', stat.bytesSent);
      console.log('Bytes received:', stat.bytesReceived);
    }
  }
}

// Protocol stats
console.log('Message stats:', stats.protocol);
```

These examples cover the most common use cases for WebRTPay. For more information, see the main README.md and API documentation.
