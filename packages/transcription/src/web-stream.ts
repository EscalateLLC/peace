/** Drain a web ReadableStream (a fetch/SDK response body) into Node Buffers. */
export async function* streamToBuffers (stream: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncIterable<Buffer> {
  const reader = stream.getReader();

  try {
    for (;;) {
      if (signal?.aborted) {
        return;
      }

      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      if (value) {
        yield Buffer.from(value);
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}
