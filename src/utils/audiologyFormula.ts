import { AudiogramData, FrequencyLoss, HearingAssessment, HearingLossCategory } from '../types/audio';

export const STANDARD_FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000];

export const INITIAL_AUDIOGRAM: AudiogramData = {
  leftEar: [
    { frequency: 250, dBHL: 10 },
    { frequency: 500, dBHL: 15 },
    { frequency: 1000, dBHL: 20 },
    { frequency: 2000, dBHL: 35 },
    { frequency: 4000, dBHL: 50 },
    { frequency: 8000, dBHL: 60 },
  ],
  rightEar: [
    { frequency: 250, dBHL: 10 },
    { frequency: 500, dBHL: 15 },
    { frequency: 1000, dBHL: 25 },
    { frequency: 2000, dBHL: 40 },
    { frequency: 4000, dBHL: 55 },
    { frequency: 8000, dBHL: 65 },
  ],
};

export const AUDIOGRAM_PRESETS = [
  {
    id: 'presbycusis',
    name: 'Presbycusis (High-Frequency Age Loss)',
    desc: 'Normal low frequencies with progressive sloping drop at 2kHz–8kHz. Most common for speech clarity loss.',
    data: {
      leftEar: [
        { frequency: 250, dBHL: 10 },
        { frequency: 500, dBHL: 15 },
        { frequency: 1000, dBHL: 25 },
        { frequency: 2000, dBHL: 40 },
        { frequency: 4000, dBHL: 55 },
        { frequency: 8000, dBHL: 65 },
      ],
      rightEar: [
        { frequency: 250, dBHL: 10 },
        { frequency: 500, dBHL: 15 },
        { frequency: 1000, dBHL: 25 },
        { frequency: 2000, dBHL: 45 },
        { frequency: 4000, dBHL: 60 },
        { frequency: 8000, dBHL: 70 },
      ],
    },
  },
  {
    id: 'noise_notch',
    name: 'Acoustic Trauma (4kHz Notch)',
    desc: 'Characteristic dip at 4000 Hz caused by loud machinery, concerts, or industrial noise, with partial recovery at 8kHz.',
    data: {
      leftEar: [
        { frequency: 250, dBHL: 15 },
        { frequency: 500, dBHL: 15 },
        { frequency: 1000, dBHL: 20 },
        { frequency: 2000, dBHL: 30 },
        { frequency: 4000, dBHL: 60 },
        { frequency: 8000, dBHL: 35 },
      ],
      rightEar: [
        { frequency: 250, dBHL: 15 },
        { frequency: 500, dBHL: 15 },
        { frequency: 1000, dBHL: 20 },
        { frequency: 2000, dBHL: 35 },
        { frequency: 4000, dBHL: 65 },
        { frequency: 8000, dBHL: 40 },
      ],
    },
  },
  {
    id: 'normal',
    name: 'Normal Healthy Baseline',
    desc: 'All frequencies within 0–20 dB HL threshold. Flat transparent equalization.',
    data: {
      leftEar: [
        { frequency: 250, dBHL: 10 },
        { frequency: 500, dBHL: 10 },
        { frequency: 1000, dBHL: 10 },
        { frequency: 2000, dBHL: 15 },
        { frequency: 4000, dBHL: 15 },
        { frequency: 8000, dBHL: 15 },
      ],
      rightEar: [
        { frequency: 250, dBHL: 10 },
        { frequency: 500, dBHL: 10 },
        { frequency: 1000, dBHL: 10 },
        { frequency: 2000, dBHL: 15 },
        { frequency: 4000, dBHL: 15 },
        { frequency: 8000, dBHL: 15 },
      ],
    },
  },
  {
    id: 'moderate_conductive',
    name: 'Moderate Flat Loss',
    desc: 'Uniform 35–45 dB HL attenuation across all speech frequencies. Requires uniform wideband amplification.',
    data: {
      leftEar: [
        { frequency: 250, dBHL: 35 },
        { frequency: 500, dBHL: 40 },
        { frequency: 1000, dBHL: 40 },
        { frequency: 2000, dBHL: 45 },
        { frequency: 4000, dBHL: 45 },
        { frequency: 8000, dBHL: 50 },
      ],
      rightEar: [
        { frequency: 250, dBHL: 35 },
        { frequency: 500, dBHL: 40 },
        { frequency: 1000, dBHL: 40 },
        { frequency: 2000, dBHL: 45 },
        { frequency: 4000, dBHL: 50 },
        { frequency: 8000, dBHL: 50 },
      ],
    },
  },
];

/**
 * Calculates Pure Tone Average (PTA) across 500, 1000, 2000, and 4000 Hz
 */
export function calculatePTA(losses: FrequencyLoss[]): number {
  const ptaFreqs = [500, 1000, 2000, 4000];
  const relevant = losses.filter((l) => ptaFreqs.includes(l.frequency));
  if (relevant.length === 0) return 0;
  const sum = relevant.reduce((acc, curr) => acc + curr.dBHL, 0);
  return Math.round(sum / relevant.length);
}

/**
 * Evaluates WHO Hearing Loss Category
 */
export function classifyHearingLoss(pta: number): HearingLossCategory {
  if (pta <= 20) return 'Normal';
  if (pta <= 40) return 'Mild';
  if (pta <= 65) return 'Moderate';
  if (pta <= 90) return 'Severe';
  return 'Profound';
}

/**
 * Calculates Audiological Prescription Gain using the Half-Gain Rule (modified NAL-R)
 * Gain (dB) = Loss (dB) * 0.45 + frequency slope correction
 * Caps maximum compensation gain at +24 dB to prevent acoustic feedback and cochlear hair-cell damage.
 */
export function calculatePrescriptionGains(losses: FrequencyLoss[]): { frequency: number; gainDb: number }[] {
  return losses.map((loss) => {
    // If hearing loss is normal (< 20 dB HL), zero compensation needed
    if (loss.dBHL <= 20) {
      return { frequency: loss.frequency, gainDb: 0 };
    }

    // Half-Gain base formula
    let gain = (loss.dBHL - 20) * 0.45;

    // Slight frequency-specific weightings for speech intelligibility (formant frequencies 1k-4k)
    if (loss.frequency === 2000 || loss.frequency === 4000) {
      gain += 2.0;
    } else if (loss.frequency === 250) {
      // Reduce low-frequency gain to avoid upward spread of masking
      gain *= 0.6;
    }

    // Safety limiter cap at +24 dB
    const clampedGain = Math.min(24, Math.max(0, Math.round(gain * 10) / 10));

    return {
      frequency: loss.frequency,
      gainDb: clampedGain,
    };
  });
}

export function assessAudiogram(losses: FrequencyLoss[]): HearingAssessment {
  const pta = calculatePTA(losses);
  const category = classifyHearingLoss(pta);
  const gains = calculatePrescriptionGains(losses);

  let description = '';
  switch (category) {
    case 'Normal':
      description = 'Thresholds are within typical biological limits. Full speech spectrum is clearly audible.';
      break;
    case 'Mild':
      description = 'Soft speech and background noise environments cause consonant confusion (s, f, th). High-frequency boost restores clarity.';
      break;
    case 'Moderate':
      description = 'Conversational speech requires noticeable volume increase. Multi-band dynamic compression and noise gating are essential.';
      break;
    case 'Severe':
      description = 'Conversational speech is mostly inaudible without high-gain amplification. Safety peak limiters are mandatory.';
      break;
    case 'Profound':
      description = 'Very loud sounds are required. Clinical medical-grade hearing aid or cochlear implant referral is standard.';
      break;
  }

  return {
    category,
    pta,
    description,
    recommendedGainProfile: gains,
  };
}
