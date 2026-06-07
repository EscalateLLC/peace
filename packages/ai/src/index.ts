import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

/**
 * The model used for extraction/artifact generation.
 * Reads ANTHROPIC_API_KEY from the environment; override the model id with
 * PEACE_MODEL. Swap providers here — nothing else in the repo names one.
 *
 * TODO(cost): add anthropic cacheControl providerOptions once the extraction
 * prompts stabilize, so the static system block is prompt-cached.
 */
export function getDefaultModel (): LanguageModel {
  const anthropic = createAnthropic({});

  return anthropic(process.env.PEACE_MODEL ?? DEFAULT_MODEL_ID);
}
