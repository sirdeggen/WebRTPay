# Docker & TURN Server Setup - Summary

This document summarizes the Docker and TURN server infrastructure added to WebRTPay.

## What Was Added

### 1. Docker Compose Configuration
**File:** `docker-compose.yml`

Provides two services:
- **coturn**: Local TURN/STUN server for WebRTC NAT traversal
- **demo**: React demo application (optional)

### 2. TURN Server Configuration
**File:** `turnserver.conf`

Coturn server configuration with:
- **Port 3478**: STUN/TURN UDP/TCP
- **Ports 49152-49200**: UDP relay port range
- **Port 5766**: Admin CLI interface
- **Credentials**: testuser/testpass (development only)
- **Realm**: webrtpay.local

### 3. Comprehensive Documentation
**File:** `TURN_SERVER_SETUP.md`

Detailed guide covering:
- Quick start instructions
- Configuration options
- Remote device testing
- Troubleshooting
- Production deployment guidelines
- Advanced configurations
- Monitoring and debugging

### 4. Makefile for Convenience
**File:** `Makefile`

Common commands:
```bash
make quickstart    # Set up everything
make dev           # Run demo
make turn-up       # Start TURN server
make turn-down     # Stop TURN server
make turn-logs     # View logs
make docker-up     # Start all services
make help          # Show all commands
```

### 5. Updated Documentation
- **README.md**: Added local development setup section
- **GETTING_STARTED.md**: Updated with quickstart instructions
- **.gitignore**: Added Docker and TURN artifacts

## Quick Start

```bash
# Start TURN server only
docker-compose up -d coturn

# Start everything (TURN + demo)
docker-compose up -d

# Or use Makefile
make turn-up        # TURN server
make dev-with-turn  # TURN + demo
```

## TURN Server Access

**Local Development:**
- URL: `turn:localhost:3478`
- Username: `testuser`
- Password: `testpass`

**Remote Devices (same network):**
- URL: `turn:YOUR_LOCAL_IP:3478`
- Username: `testuser`
- Password: `testpass`

Find your IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`

## Using in Code

```typescript
import { createConnectionManager } from 'webrtpay';

const manager = createConnectionManager({
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

## Testing TURN Server

### Method 1: WebRTC Test Tool
1. Visit https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
2. Add server: `turn:localhost:3478` with credentials
3. Click "Gather candidates"
4. Look for candidates with type "relay"

### Method 2: Demo App
1. Run `make dev`
2. Open browser console
3. Look for ICE candidates
4. Verify "relay" type candidates appear

### Method 3: View Logs
```bash
make turn-logs
# or
docker-compose logs -f coturn
```

Look for allocation messages.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  WebRTPay Demo App                              │
│  (Browser on localhost:3000)                    │
└──────────────────┬──────────────────────────────┘
                   │ WebRTC Connection Attempt
                   ↓
┌─────────────────────────────────────────────────┐
│  STUN/TURN Server (Coturn)                      │
│  - Port 3478: STUN/TURN                         │
│  - Ports 49152-49200: Relay                     │
│  - Docker Container                             │
└──────────────────┬──────────────────────────────┘
                   │
    ┌──────────────┴──────────────┐
    │                             │
    ↓                             ↓
Direct P2P          OR        TURN Relay
(if possible)              (if NAT blocks P2P)
```

## Configuration Options

### Force TURN Relay (Testing)

```typescript
const manager = createConnectionManager({
  webrtc: {
    iceServers: [{
      urls: 'turn:localhost:3478',
      username: 'testuser',
      credential: 'testpass'
    }],
    iceTransportPolicy: 'relay'  // Force TURN
  }
});
```

### External IP (Remote Devices)

Edit `turnserver.conf`:
```conf
external-ip=192.168.1.100
```

Then restart:
```bash
make turn-restart
```

## Security Notes

⚠️ **This configuration is for DEVELOPMENT ONLY**

For production:
- ✅ Enable TLS/DTLS
- ✅ Use strong credentials
- ✅ Configure external IP
- ✅ Enable authentication
- ✅ Use credential database
- ✅ Set up monitoring
- ✅ Configure rate limiting

See `TURN_SERVER_SETUP.md` for production guidelines.

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3478
lsof -i :3478

# Kill it or change port in docker-compose.yml
```

### Can't Connect from Mobile
1. Check firewall allows ports 3478 and 49152-49200
2. Use IP address, not localhost
3. Ensure mobile is on same network
4. Check `external-ip` in turnserver.conf

### No Relay Candidates
1. Check TURN server is running: `docker ps`
2. Verify credentials are correct
3. Check browser console for errors
4. View TURN logs: `make turn-logs`

## Resource Usage

Typical resources (idle):
- CPU: <5%
- Memory: ~50MB
- Disk: ~100MB

Under load (multiple connections):
- CPU: 10-30%
- Memory: 100-200MB
- Network: Depends on relay traffic

Limit resources in `docker-compose.yml` if needed.

## Files Added/Modified

**New Files:**
- `docker-compose.yml` - Docker services configuration
- `turnserver.conf` - Coturn server configuration
- `TURN_SERVER_SETUP.md` - Comprehensive setup guide
- `Makefile` - Convenient development commands
- `CONTRIBUTING.md` - Contribution guidelines

**Modified Files:**
- `README.md` - Added local development section
- `GETTING_STARTED.md` - Added quickstart with Make
- `.gitignore` - Added Docker and TURN artifacts

## Commands Reference

```bash
# TURN Server
make turn-up       # Start TURN server
make turn-down     # Stop TURN server
make turn-restart  # Restart TURN server
make turn-logs     # View TURN logs
make turn-test     # Open test instructions

# Development
make dev           # Run demo app
make dev-with-turn # Run demo + TURN
make quickstart    # Full setup

# Docker
make docker-up     # Start all services
make docker-down   # Stop all services
make docker-logs   # View all logs

# Build & Test
make build         # Build TypeScript
make type-check    # Check types
make clean         # Clean artifacts

# Help
make help          # Show all commands
```

## Benefits

✅ **Easy Testing**: One command to run TURN server
✅ **No Cloud Setup**: Test locally without external services
✅ **Reproducible**: Same environment for all developers
✅ **Fast Iteration**: Quick start/stop for testing
✅ **Learning**: Understand TURN configuration
✅ **Cost-Free**: No cloud TURN server fees during development

## Next Steps

1. **Start developing**: `make quickstart && make dev`
2. **Test connections**: Open demo in two tabs
3. **Check TURN usage**: View logs and ICE candidates
4. **Experiment**: Try different configurations
5. **Deploy**: Follow production guidelines when ready

## Support

- **Documentation**: See `TURN_SERVER_SETUP.md`
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Quick Help**: `make help`

---

**Happy Developing! 🚀**
