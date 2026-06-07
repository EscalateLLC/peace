import { generateObject, type LanguageModel } from 'ai';
import type { z } from 'zod';

export interface StructuredRequest<T> {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
}

/**
 * The single LLM seam of the pipeline. Production wraps AI SDK generateObject;
 * tests inject a fake — no model calls in CI.
 */
export type StructuredGenerator = <T>(request: StructuredRequest<T>) => Promise<T>;

export function createAiGenerator (model: LanguageModel): StructuredGenerator {
  return async request => {
    const { object } = await generateObject({
      model,
      schema: request.schema,
      system: request.system,
      prompt: request.prompt
    });

    return object;
  };
}
