# WebRTPay Development Makefile
# Provides convenient commands for common operations

.PHONY: help install dev demo turn-up turn-down turn-logs turn-restart test clean build docker-up docker-down

# Default target
help:
	@echo "WebRTPay Development Commands"
	@echo "=============================="
	@echo ""
	@echo "Setup:"
	@echo "  make install       - Install all dependencies"
	@echo "  make install-demo  - Install demo dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev           - Run demo in development mode"
	@echo "  make demo          - Same as 'make dev'"
	@echo ""
	@echo "TURN Server:"
	@echo "  make turn-up       - Start local TURN server"
	@echo "  make turn-down     - Stop local TURN server"
	@echo "  make turn-restart  - Restart local TURN server"
	@echo "  make turn-logs     - View TURN server logs"
	@echo "  make turn-test     - Test TURN server connection"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up     - Start all services (TURN + demo)"
	@echo "  make docker-down   - Stop all services"
	@echo "  make docker-logs   - View all logs"
	@echo ""
	@echo "Build:"
	@echo "  make build         - Build TypeScript source"
	@echo "  make build-demo    - Build demo for production"
	@echo ""
	@echo "Testing:"
	@echo "  make test          - Run tests (when available)"
	@echo "  make lint          - Run linter"
	@echo "  make type-check    - Run TypeScript type checking"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean         - Remove build artifacts"
	@echo "  make clean-all     - Remove all generated files and dependencies"

# Installation
install:
	npm install

install-demo:
	cd demo && npm install

# Development
dev: install-demo
	cd demo && npm run dev

demo: dev

# TURN Server Management
turn-up:
	@echo "Starting local TURN server..."
	docker-compose up -d coturn
	@echo ""
	@echo "TURN server running at turn:localhost:3478"
	@echo "Username: testuser"
	@echo "Password: testpass"
	@echo ""
	@echo "Use 'make turn-logs' to view logs"

turn-down:
	@echo "Stopping TURN server..."
	docker-compose stop coturn
	docker-compose rm -f coturn

turn-restart:
	@echo "Restarting TURN server..."
	docker-compose restart coturn

turn-logs:
	docker-compose logs -f coturn

turn-test:
	@echo "Testing TURN server connection..."
	@echo "Open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
	@echo "Add server: turn:localhost:3478"
	@echo "Username: testuser"
	@echo "Password: testpass"
	@echo ""
	@echo "Or run: make demo"
	@echo "And check browser console for ICE candidates with type 'relay'"

# Docker Management
docker-up:
	@echo "Starting all services..."
	docker-compose up -d
	@echo ""
	@echo "Services running:"
	@echo "  - TURN server: turn:localhost:3478"
	@echo "  - Demo app: http://localhost:3000"
	@echo ""
	@echo "Use 'make docker-logs' to view logs"

docker-down:
	@echo "Stopping all services..."
	docker-compose down

docker-logs:
	docker-compose logs -f

# Build
build:
	npm run build

build-demo:
	cd demo && npm run build

# Testing
test:
	@echo "Tests not yet implemented"
	@echo "TODO: Add unit and integration tests"

lint:
	npm run lint

type-check:
	npm run type-check

# Cleanup
clean:
	rm -rf dist
	rm -rf demo/dist
	rm -f turnserver.log
	@echo "Build artifacts cleaned"

clean-all: clean
	rm -rf node_modules
	rm -rf demo/node_modules
	docker-compose down -v
	@echo "All dependencies and Docker volumes removed"

# Development with TURN
dev-with-turn: turn-up
	@echo "Waiting for TURN server to start..."
	@sleep 2
	$(MAKE) dev

# Quick start for new developers
quickstart: install install-demo turn-up
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║  WebRTPay Development Environment Ready!              ║"
	@echo "╚════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Run 'make dev' to start the demo"
	@echo "  2. Open http://localhost:3000 in two browser tabs"
	@echo "  3. Tab 1: Create → Generate QR Code"
	@echo "  4. Tab 2: Join → Start Camera → Scan QR"
	@echo ""
	@echo "TURN server is running at turn:localhost:3478"
	@echo ""
	@echo "For more commands, run 'make help'"

# Development shortcuts
start: dev
stop: turn-down
restart: turn-restart dev
status:
	@echo "Docker services status:"
	@docker-compose ps
logs: docker-logs
