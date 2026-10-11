.PHONY: default install dev bot build start typecheck lint clean

default: ## List available targets
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

install: ## Install dependencies with Bun
	bun install

dev: ## Start Next.js development server (Dashboard + API + WhatsApp client)
	bun run dev

bot: ## Run standalone headless CLI WhatsApp bot with terminal QR
	bun run bot

build: ## Build Next.js application for production
	bun run build

start: ## Start production Next.js server
	bun run start

typecheck: ## Run TypeScript type checker
	bun run typecheck

lint: ## Run ESLint
	bun run lint

clean: ## Clean build artifacts and temporary session caches
	rm -rf .next dist .auth node_modules/.cache
