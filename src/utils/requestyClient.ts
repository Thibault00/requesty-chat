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
  if (cachedModels) return cachedModels.map((m) => `${m.provider}/${m.model}`);

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

    // Fetch the raw text response first
    const text = await response.text();
    logger.log('Raw response text:', text.substring(0, 100)); // Log first 100 characters for brevity

    let data: any;

    try {
      // Attempt to parse the text as JSON
      data = JSON.parse(text);
      logger.log('Data after first parse:', data);
    } catch (firstParseError) {
      logger.error('First JSON parse failed:', firstParseError);
      throw new Error('Invalid JSON format from models API');
    }

    // Check if data is a string (indicating double-encoded JSON)
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
        logger.log('Data after second parse:', data);
      } catch (secondParseError) {
        logger.error('Second JSON parse failed:', secondParseError);
        throw new Error('Invalid JSON format from models API after second parse');
      }
    }

    // Ensure data is an array
    if (!Array.isArray(data)) {
      logger.error('Invalid response structure:', data);
      throw new Error('Invalid response format from models API');
    }

    logger.log('Number of models found:', data.length);
    logger.log('First 3 models:', data.slice(0, 3));

    // Validate each item to ensure it matches ModelInfo structure
    const isValid = data.every((item: any) =>
      typeof item.provider === 'string' &&
      typeof item.model === 'string' &&
      typeof item.input_tokens_price_per_million === 'string' &&
      typeof item.output_tokens_price_per_million === 'string' &&
      typeof item.updated_at === 'string'
    );

    if (!isValid) {
      logger.error('Invalid model info structure in response:', data);
      throw new Error('Invalid model info structure from models API');
    }

    // Cast data to ModelInfo[] after validation
    const models: ModelInfo[] = data;

    // Sort models by provider and name
    const sortedModels = models.sort((a, b) => {
      const providerOrder: { [key: string]: number } = {
        anthropic: 1,
        openai: 2,
        google: 3,
        deepinfra: 4,
      };

      const aOrder = providerOrder[a.provider] || 999;
      const bOrder = providerOrder[b.provider] || 999;

      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.model.localeCompare(b.model);
    });

    cachedModels = sortedModels;
    const modelList = sortedModels.map((m) => `${m.provider}/${m.model}`);
    logger.log('Final model list (first 5):', modelList.slice(0, 5));
    return modelList;
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
  const modelInfo = cachedModels.find((m) => m.provider === provider && m.model === modelName);

  if (!modelInfo) return null;

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
