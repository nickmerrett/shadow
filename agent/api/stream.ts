// === Cline API Stream Abstraction === //

export type APIStream = AsyncGenerator<APIStreamChunk>;


export type APIStreamChunk = ApiStreamTextChunk | ApiStreamReasoningChunk | ApiStreamUsageChunk;


export interface ApiStreamTextChunk {
	type: "text"
	text: string
}


export interface ApiStreamReasoningChunk {
	type: "reasoning"
	reasoning: string
}


export interface ApiStreamUsageChunk {
	type: "usage"
	inputTokens: number
	outputTokens: number
	cacheWriteTokens?: number
	cacheReadTokens?: number
	thoughtsTokenCount?: number
	totalCost?: number
}