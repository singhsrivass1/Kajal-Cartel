import { GoogleGenerativeAI } from '@google/generative-ai';

export const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'] as const;

type GeminiPart = { inlineData: { data: string; mimeType: string } } | { text: string };

export async function generateWithFallbacks(
  parts: GeminiPart[],
  apiKey: string,
  logPrefix = '[gemini]'
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelId of GEMINI_FALLBACK_MODELS) {
    try {
      console.info(`${logPrefix} Attempting model: ${modelId}`);
      const model = genAI.getGenerativeModel({ model: modelId });
      const result = await model.generateContent(parts);
      const text = result.response.text();
      if (!text || !text.trim()) throw new Error(`Empty response from ${modelId}`);
      console.info(`${logPrefix} Success with model: ${modelId}`);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`${logPrefix} ${modelId} failed — ${msg}. Trying next fallback.`);
      lastError = err;
    }
  }

  throw lastError ?? new Error('All models in the fallback cascade failed.');
}
