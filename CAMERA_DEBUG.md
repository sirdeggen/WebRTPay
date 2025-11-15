# Camera Debugging Guide

## Testing the Camera Scanner

### Step 1: Start the Demo
```bash
cd demo
npm run dev
```

### Step 2: Open Browser Console
1. Open http://localhost:3000
2. Press F12 or Cmd+Option+I to open DevTools
3. Go to Console tab

### Step 3: Test Camera
1. Click "Join" tab
2. Click "Start Camera" button
3. Watch console for these messages:

**Expected Console Output:**
```
Scanner init skipped: { isScanning: false, hasVideo: false, hasScanner: false }
(when button clicked)
Initializing scanner...
Creating scanner on video element
Scanner created successfully
```

**If you see errors:**
- Check camera permissions in browser
- Check if another app is using camera
- Try different browser

### Step 4: Visual Feedback

You should see:
1. **Immediately:** "Initializing Camera..." header
2. **Video container** with "Starting camera..." overlay
3. **Permission prompt** (if first time)
4. **After granting:** Camera feed visible, overlay disappears
5. **Header changes to:** "Scanning QR Code..."
6. **Instruction:** "Point your camera at the QR code"

### Common Issues

#### "Scanner init skipped" repeatedly
- Video element not rendering
- Check if `isScanning` state is true
- Check React DevTools

#### No permission prompt
- Camera already blocked
- Go to browser settings → Site permissions → Camera → Allow

#### Black screen
- Camera in use by another app
- Close other apps using camera

#### Worker errors
- Check Network tab for failed worker.js requests
- qr-scanner should load its worker automatically

### Debug Mode

Add to browser console to enable verbose logging:
```javascript
localStorage.setItem('debug', 'qr-scanner:*');
```

Refresh page and try again.

### Manual Test

To test if qr-scanner works at all:
```javascript
import QrScanner from 'qr-scanner';

// Check camera support
const hasCamera = await QrScanner.hasCamera();
console.log('Has camera:', hasCamera);

// List cameras
const cameras = await QrScanner.listCameras(true);
console.log('Available cameras:', cameras);
```

### Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome | ✅ Works | Best support |
| Firefox | ✅ Works | Good support |
| Safari | ⚠️ Limited | May need HTTPS |
| Edge | ✅ Works | Chromium-based |

### HTTPS Requirement

Camera access requires HTTPS in production. For local testing:
- `localhost` works without HTTPS
- `127.0.0.1` works without HTTPS
- LAN IP (192.168.x.x) needs HTTPS or permission override

### Testing with Real QR Code

Generate a test QR code:
```bash
# In another terminal
cd demo
npm run dev

# Open in first tab - click Create → Generate QR
# Open in second tab - click Join → Start Camera
# Point second tab's camera at first tab's QR code
```

Or use an online QR generator with this test data:
```json
{"o":{"type":"offer","sdp":"test"},"i":[],"m":{"timestamp":1234567890,"connectionId":"test123"}}
```

---

**Still not working?** Check the browser console output and report what you see!
