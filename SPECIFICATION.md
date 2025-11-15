# Technical Specification: Mobile-to-Mobile WebRTC Connection System

## 1. Platform Scope

Web application rendered inside a mobile WebView on iOS and Android. Must also function in standard mobile browsers. No native APIs leveraged beyond the WebView container.

## 2. Purpose

Establish a short-lived, peer-to-peer communication channel between two mobile devices for the exchange of JSON messages used in a payment interaction. Connection duration measured in seconds.

## 3. Transport Layer

**Primary transport:** WebRTC data channel.

**Fallback components:**
- STUN for NAT discovery
- TURN for relay when direct connectivity is not possible
- TURN servers assumed to be user-operated

No alternative transport mechanisms required unless a future browser standard supersedes WebRTC.

## 4. Message Protocol

Payloads are JSON objects.

Framing, schema, validation, and semantics defined at application layer.

WebRTC data channel transmits raw JSON strings. Application layer handles serialization and integrity guarantees.

## 5. Connection Establishment Methods

### 5.1. Local (QR-Based) Bootstrapping

**Flow:**
1. Device A produces a QR code
2. QR code contains a bootstrap JSON blob including:
   - Offer SDP
   - ICE candidates
   - Connection metadata
3. Device B scans the QR code
4. Scanning immediately triggers creation of a WebRTC answer
5. Standard ICE/WebRTC handshake begins between devices
6. No reverse scanning required

**Implementation Details:**
- QR payload compressed for scanability
- Payload size target: <2KB for optimal scanning
- Error correction level: Medium (M)
- Format: Base64-encoded JSON

### 5.2. Remote Bootstrapping (Lookup Server + Topic Broadcaster)

Two external components required:

#### 5.2.1. Topic Broadcaster

**Purpose:** Publish connection proposal tokens

**Operations:**
- User publishes a "connection proposal token"
- Token is a JSON blob equivalent to QR bootstrap payload
- Token includes a logical username or handle
- Broadcaster associates token with username
- Token made discoverable via Lookup Resolver

**API Requirements:**
```
POST /publish
  Body: { username, token, ttl }
  Response: { tokenId, expiresAt }

DELETE /publish?username=<username>
  Response: { success }

PATCH /publish
  Body: { username, ttl }
  Response: { success }
```

#### 5.2.2. Lookup Resolver

**Purpose:** Retrieve published tokens

**Operations:**
- Counterparty queries for a given username
- If token exists and is recent, resolver returns it
- Client uses token to initiate WebRTC connection (same as QR flow)

**API Requirements:**
```
GET /lookup?username=<username>
  Response: { token, username, publishedAt }

GET /health
  Response: { status }
```

## 6. Connection Lifecycle

### 6.1. State Machine

```
IDLE
  ↓ (create offer)
CREATING_OFFER
  ↓ (offer created)
AWAITING_ANSWER
  ↓ (answer received)
CONNECTING
  ↓ (ICE success)
CONNECTED
  ↓ (message exchange complete)
CLOSED

Alternative paths:
CONNECTING → FAILED (ICE failed, no TURN)
CONNECTED → DISCONNECTED → CLOSED
Any state → FAILED (error condition)
```

### 6.2. Detailed Flow

1. **Bootstrap Acquisition:**
   - QR: Generate offer → Encode → Display QR → Scan → Decode
   - Remote: Generate offer → Publish → Lookup → Retrieve

2. **ICE Negotiation:**
   - Gather local ICE candidates
   - Exchange candidates with peer
   - STUN servers attempt direct connection
   - TURN relay used if STUN fails

3. **Data Channel Establishment:**
   - Offerer creates data channel during offer creation
   - Answerer receives data channel via ondatachannel event
   - Channel opens when ICE connected

4. **Message Exchange:**
   - Bidirectional JSON message flow
   - Messages validated against schemas
   - Message history maintained
   - Failed messages queued for retry

5. **Teardown:**
   - Application signals completion
   - Data channel closed
   - Peer connection closed
   - Resources released

## 7. Reliability and Constraints

### 7.1. Performance Targets

- **Time-to-connect:** <5 seconds (STUN), <10 seconds (TURN)
- **QR scan time:** <3 seconds
- **Message latency:** <50ms (P2P), <200ms (TURN)
- **QR payload:** <2KB optimized

### 7.2. Token Validity

- **Default TTL:** 5 minutes (300000ms)
- **Minimum TTL:** 1 minute
- **Maximum TTL:** 15 minutes
- Expired tokens rejected at connection time

### 7.3. Connection Constraints

- No persistent identity required
- No long-term connection support
- No storage beyond transient in-memory state
- Connection auto-closes after inactivity

### 7.4. TURN Fallback

- Automatic detection of connection failure
- Seamless fallback to TURN relay
- No user intervention required
- TURN servers must be pre-configured

## 8. Security Expectations

### 8.1. Transport Security

- WebRTC uses DTLS-SRTP encryption (mandatory)
- Key exchange via DTLS handshake
- Per-session ephemeral keys
- No additional crypto layer required

### 8.2. Authorization Model

- Token publication ≠ payment authorization
- Token enables communication establishment only
- Payment authorization at application layer
- Additional authentication recommended

### 8.3. Privacy Considerations

- ICE candidates may leak local IP addresses
- Use TURN-only mode for IP privacy if needed
- Tokens should not contain sensitive payment data
- Connection metadata includes only timestamps and IDs

## 9. Message Protocol Specification

### 9.1. Message Structure

```typescript
{
  type: string;           // Message type identifier
  payload: unknown;       // Type-specific payload
  timestamp: number;      // Unix timestamp (ms)
  messageId: string;      // Unique message ID
}
```

### 9.2. Standard Message Types

- `payment_request`: Initiate payment
- `payment_response`: Respond to payment request
- `payment_acknowledgment`: Confirm payment completion
- `error`: Error notification
- `handshake`: Protocol negotiation
- `ping` / `pong`: Keep-alive

### 9.3. Schema Validation

- Required fields enforced per message type
- Custom validation functions supported
- Validation failures reject message
- Malformed messages logged and ignored

### 9.4. Message Ordering

- Data channel uses ordered delivery
- In-order message processing guaranteed
- No explicit sequence numbers needed
- Retransmission handled by WebRTC

## 10. Error Handling

### 10.1. Error Types

- `BOOTSTRAP_GENERATION_FAILED`: Offer creation failed
- `BOOTSTRAP_PARSE_FAILED`: Token parsing failed
- `CONNECTION_FAILED`: WebRTC connection failed
- `ICE_FAILED`: ICE negotiation failed
- `DATA_CHANNEL_FAILED`: Channel creation failed
- `MESSAGE_SEND_FAILED`: Message transmission failed
- `TIMEOUT`: Operation timed out
- `REMOTE_SERVICE_ERROR`: Broadcaster/Lookup error

### 10.2. Retry Strategy

- Automatic retry with exponential backoff
- Default: 3 retries, 1s → 2s → 4s delays
- Max delay: 10 seconds
- Connection-level and message-level retry

### 10.3. Graceful Degradation

- TURN fallback on STUN failure
- Message queuing on temporary failures
- Connection state preservation during retries
- User notification on permanent failures

## 11. Implementation Requirements

### 11.1. Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14.1+
- Mobile Chrome (Android 5.0+)
- Mobile Safari (iOS 14.3+)

### 11.2. WebView Requirements

**iOS WKWebView:**
- Camera permissions in Info.plist
- Media playback without user action
- File URL access enabled

**Android WebView:**
- JavaScript enabled
- DOM storage enabled
- Camera permissions in manifest
- WebChromeClient for permission handling

### 11.3. Dependencies

- qrcode: QR generation
- jsqr: QR scanning
- TypeScript: Type safety
- Native WebRTC APIs (no polyfills)

## 12. Testing Considerations

### 12.1. Unit Tests

- Connection state transitions
- Message serialization/validation
- Token generation/parsing
- Error handling

### 12.2. Integration Tests

- End-to-end connection establishment
- QR code generation and scanning
- Remote bootstrapping flow
- Message exchange

### 12.3. Performance Tests

- Connection time measurements
- Message latency benchmarks
- QR scan speed
- TURN fallback timing

### 12.4. Mobile Testing

- iOS WebView integration
- Android WebView integration
- Various network conditions
- Camera hardware variations

## 13. Deployment Considerations

### 13.1. STUN/TURN Infrastructure

- Public STUN servers for development
- Private TURN servers for production
- Redundant TURN servers recommended
- Geographic distribution for latency

### 13.2. Remote Services (Optional)

- Broadcaster service scaling
- Lookup service caching
- Token expiration cleanup
- Rate limiting

### 13.3. Monitoring

- Connection success/failure rates
- ICE negotiation timing
- STUN vs TURN usage ratio
- Message throughput

## 14. Future Enhancements

### 14.1. Potential Improvements

- Multi-party connections
- File transfer support
- Video/audio channels
- Connection resumption
- Alternative signaling methods

### 14.2. Protocol Evolution

- Version negotiation in handshake
- Backward compatibility requirements
- Migration strategies
- Deprecation policy

## 15. References

- WebRTC 1.0 Specification: https://www.w3.org/TR/webrtc/
- ICE (RFC 8445): https://tools.ietf.org/html/rfc8445
- STUN (RFC 5389): https://tools.ietf.org/html/rfc5389
- TURN (RFC 5766): https://tools.ietf.org/html/rfc5766
- DTLS-SRTP (RFC 5764): https://tools.ietf.org/html/rfc5764
