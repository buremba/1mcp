.PHONY: help init dev build test clean format lint

help:
	@echo "relay-mcp development commands:"
	@echo "  make init        - Initialize project (install deps, build packages)"
	@echo "  make dev         - Start development server with hot reload"
	@echo "  make build       - Build all packages"
	@echo "  make test        - Run tests"
	@echo "  make format      - Format code with Biome"
	@echo "  make lint        - Lint code with Biome"
	@echo "  make clean       - Clean build artifacts"

init:
	@echo "📦 Installing dependencies..."
	@npm install
	@echo "🔨 Building all packages..."
	@$(MAKE) build
	@echo "✅ Initialization complete!"

build:
	@echo "Building packages in dependency order..."
	@cd packages/shared && npm run build
	@cd packages/server && npm run build
	@echo "✅ All packages built!"

dev:
	@echo "🚀 Starting development server..."
	@cd packages/server && npm run dev

test:
	@npm test

format:
	@npm run format

lint:
	@npm run lint:fix

clean:
	@echo "🧹 Cleaning build artifacts..."
	@find packages -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf .relay/capsules/*
	@echo "✅ Clean complete!"
