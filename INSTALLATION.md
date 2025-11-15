# Installation Guide

Complete installation guide for WebRTPay development environment.

## Prerequisites

### Required

- **Node.js 16+** (18+ recommended)
- **npm 7+** or **yarn 1.22+**
- **Git**

### Optional

- **Docker** (for local TURN server)
- **Make** (for convenience commands)

## Installation Steps

### 1. Check Prerequisites

```bash
# Check Node.js version
node --version  # Should be v16+ (v18+ recommended)

# Check npm version
npm --version   # Should be 7+

# Check Docker (optional)
docker --version

# Check Make (optional)
make --version
```

### 2. Clone Repository

```bash
git clone https://github.com/yourusername/webrtpay.git
cd webrtpay
```

### 3. Install Root Dependencies

```bash
npm install
```

This installs:
- `qrcode` - QR code generation
- `jsqr` - QR code scanning
- TypeScript and build tools
- ESLint and type definitions

### 4. Install Demo Dependencies

```bash
cd demo
npm install
cd ..
```

Or use the convenience script:

```bash
npm run install-demo
```

Or use Make:

```bash
make install-demo
```

This installs:
- React and React DOM
- Vite development server
- Type definitions
- Build tools

### 5. Verify Installation

```bash
# Check TypeScript compilation
npm run build

# Check type checking
npm run type-check

# Should see "dist" directory created
ls -la dist
```

## Quick Setup (All-in-One)

Using Make (recommended):

```bash
make quickstart
```

This will:
1. Install root dependencies
2. Install demo dependencies
3. Start local TURN server
4. Show next steps

## Dependency Overview

### Root Package (`package.json`)

**Runtime Dependencies:**
- `qrcode@^1.5.3` - Generate QR codes
- `jsqr@^1.4.0` - Parse QR codes

**Dev Dependencies:**
- `typescript@^5.3.3` - TypeScript compiler
- `@types/node@^20.10.0` - Node.js type definitions
- `@types/qrcode@^1.5.5` - QR code type definitions
- `eslint@^8.55.0` - Code linting
- `@typescript-eslint/*` - TypeScript ESLint plugins

### Demo Package (`demo/package.json`)

**Runtime Dependencies:**
- `react@^18.2.0` - React framework
- `react-dom@^18.2.0` - React DOM renderer

**Dev Dependencies:**
- `vite@^5.0.7` - Build tool and dev server
- `@vitejs/plugin-react@^4.2.1` - React plugin for Vite
- `typescript@^5.3.3` - TypeScript compiler
- `@types/react@^18.2.43` - React type definitions
- `@types/react-dom@^18.2.17` - React DOM type definitions
- `@types/qrcode@^1.5.5` - QR code type definitions
- `@types/node@^20.10.0` - Node.js type definitions

Note: Demo imports `qrcode` and `jsqr` from parent package.

## Common Installation Issues

### Issue: Node.js Version Too Old

```bash
# Error: Node.js version 14.x detected
```

**Solution:**

Install Node.js 18 LTS:

```bash
# Using nvm (recommended)
nvm install 18
nvm use 18

# Or download from nodejs.org
# https://nodejs.org/
```

### Issue: npm Permission Errors

```bash
# Error: EACCES: permission denied
```

**Solution:**

Don't use sudo with npm. Fix permissions:

```bash
# Option 1: Use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18

# Option 2: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Issue: Package Lock Conflicts

```bash
# Error: npm ERR! Cannot read property 'match' of undefined
```

**Solution:**

Remove lock files and reinstall:

```bash
# Root
rm -rf node_modules package-lock.json
npm install

# Demo
cd demo
rm -rf node_modules package-lock.json
npm install
```

### Issue: TypeScript Compilation Errors

```bash
# Error: Cannot find module 'qrcode'
```

**Solution:**

Ensure dependencies are installed:

```bash
npm install
cd demo && npm install
```

### Issue: Docker Not Found

```bash
# Error: docker: command not found
```

**Solution:**

TURN server is optional for development. Skip Docker setup or install:

- **macOS:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux:** `sudo apt-get install docker.io`
- **Windows:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop)

Or use public STUN servers (no TURN relay):

```typescript
const manager = createConnectionManager({
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  }
});
```

### Issue: Make Not Found

```bash
# Error: make: command not found
```

**Solution:**

Make is optional. Run commands manually:

```bash
# Instead of: make install
npm install && cd demo && npm install

# Instead of: make dev
cd demo && npm run dev

# Instead of: make turn-up
docker-compose up -d coturn
```

Or install Make:

- **macOS:** `xcode-select --install`
- **Linux:** `sudo apt-get install build-essential`
- **Windows:** Use WSL2 or run commands manually

## Verifying Installation

### 1. Check TypeScript Builds

```bash
npm run build
```

Should create `dist/` directory with compiled JavaScript.

### 2. Check Type Checking

```bash
npm run type-check
```

Should complete without errors.

### 3. Check Demo Starts

```bash
cd demo
npm run dev
```

Should start dev server at http://localhost:3000

### 4. Check TURN Server (Optional)

```bash
docker-compose up -d coturn
docker-compose ps
```

Should show coturn running.

## IDE Setup

### VS Code (Recommended)

**Recommended Extensions:**
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Docker (if using TURN server)

**Settings:**

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### Other IDEs

WebRTPay works with any IDE that supports TypeScript:
- WebStorm
- Sublime Text with TypeScript plugin
- Vim/Neovim with CoC or LSP
- Emacs with tide or lsp-mode

## Next Steps

After successful installation:

1. **Read the Getting Started Guide**
   ```bash
   cat GETTING_STARTED.md
   ```

2. **Start Development**
   ```bash
   make dev
   # or
   cd demo && npm run dev
   ```

3. **Start TURN Server**
   ```bash
   make turn-up
   # or
   docker-compose up -d coturn
   ```

4. **Test in Browser**
   - Open http://localhost:3000
   - Open another tab/window
   - Create QR on one, scan on other

5. **Read Documentation**
   - [README.md](README.md) - Main documentation
   - [EXAMPLES.md](EXAMPLES.md) - Code examples
   - [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - API reference

## Clean Installation

To start fresh:

```bash
# Remove all dependencies and build artifacts
make clean-all

# Or manually:
rm -rf node_modules package-lock.json dist
rm -rf demo/node_modules demo/package-lock.json demo/dist
docker-compose down -v

# Reinstall
npm install
cd demo && npm install
```

## Updating Dependencies

```bash
# Check outdated packages
npm outdated
cd demo && npm outdated

# Update all packages
npm update
cd demo && npm update

# Update specific package
npm install qrcode@latest
```

## Using Yarn Instead of npm

WebRTPay supports yarn:

```bash
# Install with yarn
yarn install
cd demo && yarn install

# Run scripts
yarn build
yarn demo

# Start dev server
cd demo && yarn dev
```

## Using pnpm

WebRTPay also works with pnpm:

```bash
# Install pnpm
npm install -g pnpm

# Install dependencies
pnpm install
cd demo && pnpm install

# Run scripts
pnpm build
pnpm demo
```

## Production Build

To prepare for production deployment:

```bash
# Build library
npm run build

# Build demo
cd demo && npm run build

# Preview production build
npm run preview
```

## CI/CD Setup

Example GitHub Actions workflow:

```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run type-check
      - run: cd demo && npm ci
      - run: cd demo && npm run build
```

## Troubleshooting Help

If you encounter issues:

1. **Check versions:**
   ```bash
   node --version
   npm --version
   ```

2. **Clean install:**
   ```bash
   make clean-all
   npm install
   ```

3. **Check logs:**
   ```bash
   npm install --verbose
   ```

4. **Search issues:**
   - GitHub Issues: https://github.com/yourusername/webrtpay/issues
   - Stack Overflow: Tag `webrtpay`

5. **Ask for help:**
   - GitHub Discussions
   - Discord community
   - Email: support@webrtpay.dev

## Support

Need help with installation?

- **Documentation:** Check all .md files
- **Issues:** Report installation bugs
- **Discussions:** Ask installation questions
- **Make Help:** Run `make help`

---

**Installation Complete!** Ready to start developing with WebRTPay 🚀
