# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NestJS backend API for generating anime-style illustrations using Google Gemini AI (gemini-2.0-flash-preview-image-generation model).

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm start:dev

# Build
pnpm build

# Production
pnpm start:prod

# Run tests
pnpm test

# Run single test file
pnpm test -- path/to/file.spec.ts

# Lint
pnpm lint
```

## Architecture

```
src/
├── app.module.ts              # Root module with ConfigModule (global)
├── main.ts                    # Bootstrap with CORS and ValidationPipe
└── image-generation/          # Image generation feature module
    ├── dto/
    │   └── generate-image.dto.ts   # Request validation with enums (AnimeStyle, AspectRatio)
    ├── image-generation.service.ts  # Google GenAI integration
    ├── image-generation.controller.ts # REST endpoints
    └── image-generation.module.ts
```

## API Endpoints

* `POST /api/images/generate` - Generate image, returns base64
* `POST /api/images/generate-and-save` - Generate and save to disk
* `GET /api/images/styles` - List available anime styles
* `GET /api/images/aspect-ratios` - List aspect ratios
* `GET /api/images/:filename` - Serve generated image

## Configuration

Requires `GOOGLE_API_KEY` environment variable. Get from https://aistudio.google.com/apikey

## Key Patterns

* Uses `@google/genai` SDK with `Modality.TEXT` and `Modality.IMAGE` response types
* DTOs use class-validator decorators for request validation
* Generated images stored in `./generated-images/` directory


