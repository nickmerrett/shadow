# AI SDK Migration Summary

This document outlines the migration from direct provider SDKs to the Vercel AI SDK for LLM calls in the Shadow project.

## Migration Overview

### Before
- Used `@anthropic-ai/sdk` directly
- Only supported Anthropic models (Claude variants)
- Custom streaming implementation
- Basic usage tracking (inputTokens/outputTokens)
- Single provider configuration

### After  
- Uses Vercel AI SDK (`ai` package) with `@ai-sdk/anthropic` and `@ai-sdk/openai`
- Supports both Anthropic and OpenAI models
- Standardized streaming via AI SDK
- Enhanced usage tracking (promptTokens/completionTokens/totalTokens)
- Multi-provider configuration with graceful fallbacks

## Key Changes

### 1. Dependencies (`apps/server/package.json`)
```diff
- "@anthropic-ai/sdk": "^0.30.1"
+ "@ai-sdk/anthropic": "^1.0.5"
+ "@ai-sdk/openai": "^1.0.10"
+ "ai": "^4.1.5"
```

### 2. Types (`packages/types/src/index.ts`)
- **AI SDK Integration**: Added `CoreMessage` compatibility functions
- **Enhanced Usage Tracking**: Changed from `inputTokens/outputTokens` to `promptTokens/completionTokens/totalTokens`  
- **Multi-Provider Support**: Added provider field to model configurations
- **Extended Model Support**: Added OpenAI models (GPT-4o, GPT-4o Mini, GPT-4 Turbo)
- **Model Information**: Added comprehensive `ModelInfos` with pricing, capabilities, and limits
- **Finish Reasons**: Standardized completion reasons across providers

### 3. Database Schema (`packages/db/prisma/schema.prisma`)
```diff
model ChatMessage {
  // ... existing fields ...
+ // Usage tracking (denormalized for easier querying)
+ promptTokens      Int? // Input tokens
+ completionTokens  Int? // Output tokens  
+ totalTokens       Int? // Total tokens
+ finishReason      String? // stop, length, content-filter, etc
+ @@index([llmModel, createdAt]) // For usage analytics
}
```

### 4. Configuration (`apps/server/src/config.ts`)
- **Dual API Keys**: Both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are now optional
- **Validation**: At least one API key must be provided
- **Graceful Degradation**: Missing API keys disable specific providers rather than breaking the app

### 5. LLM Service (`apps/server/src/llm.ts`)
**Complete rewrite** using AI SDK:
- **Provider Factory**: Dynamic model instance creation based on model type
- **Unified Streaming**: Uses AI SDK's `streamText()` for consistent streaming across providers
- **Enhanced Error Handling**: Better error messages and provider-specific error handling
- **Available Models**: Dynamic model availability based on configured API keys

### 6. Chat Service (`apps/server/src/chat.ts`)
- **Enhanced Message Storage**: Denormalized usage fields for better querying
- **Improved Usage Tracking**: Stores both detailed metadata and denormalized usage fields
- **Type Safety**: Uses `ModelType` instead of raw strings
- **Model Discovery**: Exposes available models endpoint

### 7. API Endpoints (`apps/server/src/app.ts`)
**New endpoint**:
```typescript
GET /api/models
// Returns available models with full metadata (name, provider, pricing, capabilities)
```

### 8. Socket Integration (`apps/server/src/socket.ts`)
- **Type Safety**: Uses `ModelType` for model parameter validation
- **Backward Compatibility**: Maintains existing socket event structure

## Benefits of Migration

### 1. **Standardization**
- Consistent API across all LLM providers
- Unified streaming implementation
- Standardized error handling and usage tracking

### 2. **Multi-Provider Support**
- Easy to add new providers (just add API key and they become available)
- Users can choose between Anthropic and OpenAI models
- Graceful fallback when providers are unavailable

### 3. **Enhanced Observability**
- Better usage tracking with standardized token counting
- Finish reasons for debugging incomplete responses
- Denormalized database fields for efficient analytics queries

### 4. **Future-Proofing**
- AI SDK actively maintained by Vercel
- Easy to add new providers as they become available
- Built-in support for emerging LLM features (tools, multimodal, etc.)

### 5. **Developer Experience**
- Cleaner, more maintainable code
- Better TypeScript support
- Consistent patterns across the codebase

## Available Models

### Anthropic Models
- **Claude 3.5 Sonnet** (`claude-3-5-sonnet-20241022`) - Most capable
- **Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`) - Fastest & cheapest  
- **Claude 3 Haiku** (`claude-3-haiku-20240307`) - Legacy fast model

### OpenAI Models  
- **GPT-4o** (`gpt-4o`) - Most advanced multimodal
- **GPT-4o Mini** (`gpt-4o-mini`) - Cost-efficient for simple tasks
- **GPT-4 Turbo** (`gpt-4-turbo`) - Previous generation with large context

## Migration Impact

### Database Changes
You'll need to run a migration to add the new fields to the `ChatMessage` table:
```sql
ALTER TABLE "ChatMessage" ADD COLUMN "promptTokens" INTEGER;
ALTER TABLE "ChatMessage" ADD COLUMN "completionTokens" INTEGER;  
ALTER TABLE "ChatMessage" ADD COLUMN "totalTokens" INTEGER;
ALTER TABLE "ChatMessage" ADD COLUMN "finishReason" TEXT;
CREATE INDEX "ChatMessage_llmModel_createdAt_idx" ON "ChatMessage"("llmModel", "createdAt");
```

### Environment Variables
Add OpenAI support (optional):
```bash
OPENAI_API_KEY=your_openai_api_key_here
# ANTHROPIC_API_KEY is still supported and optional
```

### Breaking Changes
- **Type Changes**: `LLMMessage` interface removed, use `Message` instead
- **Usage Tracking**: Old `inputTokens/outputTokens` changed to `promptTokens/completionTokens`
- **Model Parameter**: Socket events now expect `ModelType` instead of raw strings

## Next Steps

1. **Install Dependencies**: Run `npm install` in the server directory
2. **Database Migration**: Apply the schema changes to your database
3. **Environment Setup**: Add OpenAI API key if desired
4. **Frontend Updates**: Update any frontend code that references the old usage tracking fields
5. **Testing**: Verify both Anthropic and OpenAI models work correctly

The migration maintains backward compatibility where possible while providing a solid foundation for future AI feature development.