export interface FrequencyLoss {
  frequency: number; // in Hz: 250, 500, 1000, 2000, 4000, 8000
  dBHL: number; // 0 to 90 dB HL (Hearing Level)
}

export interface AudiogramData {
  leftEar: FrequencyLoss[];
  rightEar: FrequencyLoss[];
}

export type EarSelection = 'left' | 'right' | 'both';

export type HearingLossCategory = 'Normal' | 'Mild' | 'Moderate' | 'Severe' | 'Profound';

export interface HearingAssessment {
  category: HearingLossCategory;
  pta: number; // Pure Tone Average (500, 1000, 2000, 4000 Hz)
  description: string;
  recommendedGainProfile: { frequency: number; gainDb: number }[];
}

export interface DspState {
  isStreaming: boolean;
  audioSource: 'mic' | 'sample_speech_noise' | 'sample_ambient_cafe' | 'sample_clean_voice';
  noiseReductionLevel: 'off' | 'light' | 'moderate' | 'aggressive';
  noiseGateThreshold: number; // dB (-60 to -20)
  highPassFilter: boolean; // cut <120Hz rumble
  eqEnabled: boolean;
  activeEar: EarSelection;
  simulatedBtLatencyMs: number; // 0, 25, 60, 180 ms
  compressorEnabled: boolean;
  masterVolume: number; // 0.0 to 1.5
}

export interface LatencyStage {
  name: string;
  nativeAndroidMs: number;
  flutterMs: number;
  description: string;
}
