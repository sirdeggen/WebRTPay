# WebRTPay Demo Application

React-based demo application showcasing WebRTPay's capabilities.

## Setup

### Install Dependencies

```bash
npm install
```

The demo imports WebRTPay from the parent `../src` directory, so the parent dependencies (qrcode, jsqr) are resolved from the root package.

## Running the Demo

### Quick Start

```bash
npm run dev
```

Then open http://localhost:3000 in two browser tabs.

### With TURN Server

For proper testing with NAT traversal:

```bash
# From project root
make turn-up

# Then start demo
cd demo
npm run dev
```

## Features

### 1. Connection Methods

**QR Code (Local):**
- Tab 1: Click "Create" → "Generate QR Code"
- Tab 2: Click "Join" → "Start Camera" → Scan QR
- Connection establishes automatically

**Remote Lookup:**
- Requires remote services running (see main README)
- Tab 1: Click "Create" → "Remote" → Enter username → Publish
- Tab 2: Click "Join" → "Remote" → Enter username → Connect

### 2. Messaging

Once connected:
- Type messages in the input field
- Click "Send Message" to send text
- Click "Send Test Payment" to send structured payment message
- Watch messages appear in real-time

### 3. Connection States

Monitor connection states:
- **IDLE** - Not connected
- **CREATING_OFFER** - Generating connection
- **CONNECTING** - Establishing connection
- **CONNECTED** - Ready for messaging
- **FAILED** - Connection failed
- **DISCONNECTED** - Connection lost

## Testing

### Two Browser Tabs

1. Open http://localhost:3000 in two tabs
2. Tab 1: Create connection
3. Tab 2: Join connection
4. Exchange messages

### Two Devices (Same Network)

1. Find your local IP: `ifconfig | grep "inet "`
2. Device 1: Navigate to `http://YOUR_IP:3000`
3. Device 1: Create QR code
4. Device 2: Navigate to `http://YOUR_IP:3000`
5. Device 2: Scan QR code
6. Exchange messages

### Mobile Testing

1. Ensure mobile device is on same network
2. Navigate to `http://YOUR_IP:3000` on mobile
3. Grant camera permissions when prompted
4. Test QR scanning

## Configuration

The demo uses default WebRTPay configuration with:
- Connection timeout: 30 seconds
- Auto-retry: Enabled
- Max retries: 3
- STUN servers: Google public STUN servers

### Using Local TURN Server

Update [App.tsx](src/App.tsx):

```typescript
const newManager = createConnectionManager({
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:localhost:3478',
        username: 'testuser',
        credential: 'testpass'
      }
    ]
  }
});
```

## Project Structure

```
demo/
├── src/
│   ├── App.tsx       # Main demo component
│   ├── main.tsx      # React entry point
│   └── styles.css    # Styling
├── index.html        # HTML template
├── vite.config.ts    # Vite configuration
├── tsconfig.json     # TypeScript config
└── package.json      # Dependencies
```

## Dependencies

### Runtime Dependencies
- **react** - UI framework
- **react-dom** - React DOM rendering

### Dev Dependencies
- **vite** - Build tool and dev server
- **@vitejs/plugin-react** - React plugin for Vite
- **typescript** - Type checking
- **@types/react** - React type definitions
- **@types/react-dom** - React DOM type definitions
- **@types/qrcode** - QR code type definitions
- **@types/node** - Node.js type definitions

Note: `qrcode` and `jsqr` are imported from parent package.

## Troubleshooting

### Camera Not Working

**Issue:** Camera permission denied or not accessible

**Solutions:**
- Grant camera permissions in browser
- Use HTTPS (camera requires secure context)
- Check browser console for errors
- Try different camera (front/back)

### QR Code Won't Scan

**Issue:** QR code detected but not parsing

**Solutions:**
- Ensure good lighting
- Hold camera steady, 10-30cm from QR
- Try refreshing and regenerating QR
- Check browser console for errors

### Connection Failed

**Issue:** Connection state goes to FAILED

**Solutions:**
- Check TURN server is running: `make turn-logs`
- Verify network connectivity
- Check browser console for WebRTC errors
- Try forcing TURN relay (see Configuration above)

### Types Not Found

**Issue:** TypeScript errors about missing types

**Solutions:**
```bash
# Install dependencies
npm install

# Install parent dependencies
cd .. && npm install && cd demo
```

### Port Already in Use

**Issue:** Port 3000 is already taken

**Solutions:**
```bash
# Use different port
npm run dev -- --port 3001

# Or kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## Development

### Hot Module Replacement

Vite provides instant HMR - edit files and see changes immediately.

### Type Checking

```bash
npm run type-check
```

### Building for Production

```bash
npm run build
```

Output will be in `dist/` directory.

### Preview Production Build

```bash
npm run build
npm run preview
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14.1+
- Mobile Chrome (Android 5.0+)
- Mobile Safari (iOS 14.3+)

## Known Limitations

1. **Camera Access**
   - Requires HTTPS in production
   - Some browsers restrict camera in HTTP

2. **WebRTC Support**
   - Older browsers may not support WebRTC
   - Check with `isWebRTCSupported()`

3. **Mobile Webview**
   - Some WebView configurations may block camera
   - See main README for WebView setup

## Extending the Demo

### Adding Custom Message Types

```typescript
// In App.tsx
const protocol = manager.getProtocol();

protocol.registerSchema({
  type: 'custom_message',
  requiredFields: ['customField'],
  validate: (payload) => payload.customField !== null
});

// Send custom message
await manager.send('custom_message', {
  customField: 'value'
});

// Handle custom message
manager.onMessage('custom_message', (message) => {
  console.log('Custom message:', message.payload);
});
```

### Adding UI Features

The demo uses vanilla React with inline styles. Feel free to:
- Add UI component library (MUI, Chakra, etc.)
- Add state management (Redux, Zustand, etc.)
- Add routing for multi-page app
- Add animations and transitions

## Performance

The demo is optimized for:
- Fast dev server startup (~500ms)
- Instant HMR updates
- Small bundle size (~150KB gzipped)
- Efficient React rendering

## Security Notes

This is a demo application for development and testing only.

For production:
- Enable HTTPS
- Validate all inputs
- Add authentication
- Rate limit connections
- Monitor for abuse
- See main README for security guidelines

## Support

- **Main Documentation:** See project root README.md
- **Issues:** Report bugs on GitHub
- **Discussions:** Ask questions on GitHub Discussions

## License

MIT - Same as parent project
