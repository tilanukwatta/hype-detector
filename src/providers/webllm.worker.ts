import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

/**
 * Dedicated Web Worker that hosts the WebLLM engine, so model download and
 * WebGPU inference run off the side panel's main thread. The side panel talks to
 * it via `CreateWebWorkerMLCEngine` (see `webllm.ts`), which speaks this handler's
 * message protocol.
 */
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (event: MessageEvent) => {
  handler.onmessage(event);
};
