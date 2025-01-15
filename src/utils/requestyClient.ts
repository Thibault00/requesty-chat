import fetch from 'node-fetch';
import { logger } from './logger';
import { getAPIKey } from './preferences';

interface Message {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface ChatCompletionResponse {
	choices: {
		message: {
			content: string;
		};
	}[];
}

interface ModelInfo {
	provider: string;
	model: string;
	input_tokens_price_per_million: string;
	output_tokens_price_per_million: string;
	updated_at: string;
}

let cachedModels: ModelInfo[] | null = null;

/**
 * Fetches the available models from the API and caches them.
 * @returns A promise that resolves to a list of model identifiers in the format "provider/model".
 */
export async function getAvailableModels(): Promise<string[]> {
	if (cachedModels)
		return cachedModels
			.filter((m) => parseFloat(m.input_tokens_price_per_million) > 0 && parseFloat(m.output_tokens_price_per_million) > 0)
			.map((m) => `${m.provider}/${m.model}`);

	const apiKey = await getAPIKey();
	const endpoint = 'https://api.requesty.ai/router/models';

	try {
		logger.log('Fetching models from:', endpoint);
		const response = await fetch(endpoint, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch models: ${response.statusText}`);
		}

		const text = await response.text();
		const data = JSON.parse(text);
		const models = typeof data === 'string' ? JSON.parse(data) : data;

		if (!Array.isArray(models)) {
			throw new Error('Invalid response format from models API');
		}

		cachedModels = models;
		// Only return models with valid pricing (greater than 0)
		return models
			.filter((m) => parseFloat(m.input_tokens_price_per_million) > 0 && parseFloat(m.output_tokens_price_per_million) > 0)
			.map((m) => `${m.provider}/${m.model}`);
	} catch (error) {
		logger.error('Failed to fetch models:', error);
		throw error;
	}
}

/**
 * Retrieves the pricing information for a given model.
 * @param model - The model identifier in the format "provider/model".
 * @returns An object containing input and output token prices, or null if the model is not found.
 */
export function getModelPricing(model: string): { input: number; output: number } | null {
	if (!cachedModels) return null;

	const [provider, modelName] = model.split('/');
	const modelInfo = cachedModels.find((m) => {
		if (m.provider === provider) {
			// For "together" provider, ignore everything before the last '/' in the model name
			const actualModelName = m.model.includes('/') ? m.model.split('/').pop()! : m.model;
			const searchModelName = modelName.includes('/') ? modelName.split('/').pop()! : modelName;
			return actualModelName === searchModelName;
		}
		return m.provider === provider && m.model === modelName;
	});

	if (!modelInfo) {
		return null;
	}

	return {
		input: parseFloat(modelInfo.input_tokens_price_per_million),
		output: parseFloat(modelInfo.output_tokens_price_per_million),
	};
}

/**
 * Creates a chat completion using the specified model and messages.
 * @param model - The model identifier in the format "provider/model".
 * @param messages - An array of messages to send to the model.
 * @returns A promise that resolves to the assistant's reply.
 */
export async function createChatCompletion(model: string, messages: Message[]): Promise<string> {
	const apiKey = await getAPIKey();
	const endpoint = 'https://router.requesty.ai/v1/chat/completions';

	try {
		const requestBody = {
			model: model,
			messages: messages,
			temperature: 0.7,
		};

		const maskedKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;

		logger.log('Raw Request:', {
			endpoint,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${maskedKey}`,
			},
			body: JSON.stringify(requestBody, null, 2),
		});

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(requestBody),
		});

		const rawResponse = await response.text();
		logger.log('Raw Response:', rawResponse);

		if (!response.ok) {
			logger.error('API Error Response:', {
				status: response.status,
				statusText: response.statusText,
				body: rawResponse,
			});
			throw new Error(`API request failed: ${rawResponse}`);
		}

		const data = JSON.parse(rawResponse) as ChatCompletionResponse;

		logger.log('Parsed Response:', {
			status: response.status,
			headers: Object.fromEntries(response.headers.entries()),
			data: JSON.stringify(data, null, 2),
		});

		if (!data.choices || data.choices.length === 0) {
			throw new Error('No choices returned from API');
		}

		return data.choices[0].message.content;
	} catch (error) {
		logger.error('Request Failed:', {
			error: error instanceof Error ? error.stack : String(error),
			model,
			messages,
		});
		throw new Error(`Failed to get response from ${model}: ${error instanceof Error ? error.message : String(error)}`);
	}
}
