/**
 * ggwave protocols, mirrored from upstream `include/ggwave/ggwave.h` (Protocols::kDefault).
 * `framesPerTx` / `bytesPerTx` / `extra` are needed to compute when each byte is on air.
 */
export const PROTOCOLS = [
  {
    id: "audible-normal",
    key: "GGWAVE_PROTOCOL_AUDIBLE_NORMAL",
    label: "Audible · Normal",
    freqStart: 40,
    framesPerTx: 9,
    bytesPerTx: 3,
    extra: 1,
  },
  {
    id: "audible-fast",
    key: "GGWAVE_PROTOCOL_AUDIBLE_FAST",
    label: "Audible · Fast",
    freqStart: 40,
    framesPerTx: 6,
    bytesPerTx: 3,
    extra: 1,
  },
  {
    id: "audible-fastest",
    key: "GGWAVE_PROTOCOL_AUDIBLE_FASTEST",
    label: "Audible · Fastest",
    freqStart: 40,
    framesPerTx: 3,
    bytesPerTx: 3,
    extra: 1,
  },
  {
    id: "ultrasound-normal",
    key: "GGWAVE_PROTOCOL_ULTRASOUND_NORMAL",
    label: "Ultrasound · Normal",
    freqStart: 320,
    framesPerTx: 9,
    bytesPerTx: 3,
    extra: 1,
  },
  {
    id: "ultrasound-fast",
    key: "GGWAVE_PROTOCOL_ULTRASOUND_FAST",
    label: "Ultrasound · Fast",
    freqStart: 320,
    framesPerTx: 6,
    bytesPerTx: 3,
    extra: 1,
  },
  {
    id: "ultrasound-fastest",
    key: "GGWAVE_PROTOCOL_ULTRASOUND_FASTEST",
    label: "Ultrasound · Fastest",
    freqStart: 320,
    framesPerTx: 3,
    bytesPerTx: 3,
    extra: 1,
  },
  // DT/MT are deliberately absent: upstream only supports them with fixed-length payloads
  // (ggwave.cpp rejects mono-tone for variable length and skips it on Rx). They target
  // low-rate microcontrollers; GibberLink uses variable-length audible messages.
] as const;

export type Protocol = (typeof PROTOCOLS)[number];
export type ProtocolId = Protocol["id"];

/** GibberLink's own default. */
export const DEFAULT_PROTOCOL: ProtocolId = "audible-fast";

export function getProtocol(id: ProtocolId): Protocol {
  const p = PROTOCOLS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown protocol: ${id}`);
  return p;
}

/** Upstream framing constants (ggwave.h). */
export const SAMPLES_PER_FRAME = 1024;
export const MARKER_FRAMES = 16;
export const ENCODED_DATA_OFFSET = 3;
