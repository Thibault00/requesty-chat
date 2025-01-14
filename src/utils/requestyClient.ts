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

export const AVAILABLE_MODELS = [
	'anthropic/claude-3-5-sonnet-latest',
	'openai/gpt-4o',
];

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
