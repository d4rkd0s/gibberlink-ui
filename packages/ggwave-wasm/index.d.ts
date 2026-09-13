/** Embind enum value. Compare with `===` against `module.ProtocolId.X`. */
export interface EnumValue {
  readonly value: number;
}

export interface GgwaveParameters {
  payloadLength: number;
  sampleRateInp: number;
  sampleRateOut: number;
  sampleRate: number;
  samplesPerFrame: number;
  soundMarkerThreshold: number;
  sampleFormatInp: EnumValue;
  sampleFormatOut: EnumValue;
  operatingMode: number;
}

/** Opaque instance handle returned by `init`. */
export type GgwaveInstance = number;

export interface GgwaveModule {
  SampleFormat: Record<
    | "GGWAVE_SAMPLE_FORMAT_UNDEFINED"
    | "GGWAVE_SAMPLE_FORMAT_U8"
    | "GGWAVE_SAMPLE_FORMAT_I8"
    | "GGWAVE_SAMPLE_FORMAT_U16"
    | "GGWAVE_SAMPLE_FORMAT_I16"
    | "GGWAVE_SAMPLE_FORMAT_F32",
    EnumValue
  >;
  ProtocolId: Record<string, EnumValue>;
  GGWAVE_OPERATING_MODE_RX: number;
  GGWAVE_OPERATING_MODE_TX: number;
  GGWAVE_OPERATING_MODE_RX_AND_TX: number;
  GGWAVE_OPERATING_MODE_TX_ONLY_TONES: number;
  GGWAVE_OPERATING_MODE_USE_DSS: number;

  getDefaultParameters(): GgwaveParameters;
  init(params: GgwaveParameters): GgwaveInstance;
  free(instance: GgwaveInstance): void;
  /**
   * Returns a view into WASM memory in `sampleFormatOut` bytes.
   * The view is invalidated by the next call: copy it immediately.
   */
  encode(instance: GgwaveInstance, data: string | Uint8Array, protocol: EnumValue, volume: number): Uint8Array;
  /**
   * Feed raw sample bytes in `sampleFormatInp`. Returns decoded payload bytes (empty if none yet).
   * The view is invalidated by the next call: copy it immediately.
   */
  decode(instance: GgwaveInstance, samples: Uint8Array): Uint8Array;
  rxDurationFrames(instance: GgwaveInstance): number;
  rxToggleProtocol(protocol: EnumValue, state: number): void;
  txToggleProtocol(protocol: EnumValue, state: number): void;
  enableLog(): void;
  disableLog(): void;
}

export function loadGgwave(): Promise<GgwaveModule>;
