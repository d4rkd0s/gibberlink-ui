/** ggwave variable-length payload limit (kMaxLengthVariable). */
export const MAX_PAYLOAD_BYTES = 140;

export class PayloadTooLargeError extends Error {
  readonly name = "PayloadTooLargeError";
  readonly bytes: number;
  constructor(bytes: number) {
    super(`Message is ${bytes} bytes; GibberLink carries at most ${MAX_PAYLOAD_BYTES}.`);
    this.bytes = bytes;
  }
}

export class EmptyPayloadError extends Error {
  readonly name = "EmptyPayloadError";
  constructor() {
    super("Message is empty.");
  }
}

const encoder = new TextEncoder();

/** NFC-normalise, UTF-8 encode and enforce the ggwave size limit. */
export function toPayload(input: string | Uint8Array): Uint8Array {
  const bytes = typeof input === "string" ? encoder.encode(input.normalize("NFC")) : input;
  if (bytes.length === 0) throw new EmptyPayloadError();
  if (bytes.length > MAX_PAYLOAD_BYTES) throw new PayloadTooLargeError(bytes.length);
  return bytes;
}

export function payloadBytes(text: string): number {
  return encoder.encode(text.normalize("NFC")).length;
}
