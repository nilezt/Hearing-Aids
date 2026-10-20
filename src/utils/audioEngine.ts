/**
 * AcoustiTune Real-Time Web Audio Engine
 * Handles Pure Tone Audiometry and Real-Time DSP Audio Processing Pipeline
 */

import { EarSelection } from '../types/audio';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;

  // Pure Tone Audiometry nodes
  private toneOsc: OscillatorNode | null = null;
  private toneGain: GainNode | null = null;
  private tonePanner: StereoPannerNode | null = null;

  // Real-Time DSP Pipeline nodes
  private mediaStream: MediaStream | null = null;
  private sourceNode: AudioNode | null = null;
  private syntheticSourceTimer: number | null = null;
  private syntheticAudioNodes: { osc: OscillatorNode; noise: AudioBufferSourceNode; gain: GainNode } | null = null;

  private highPassFilterNode: BiquadFilterNode | null = null;
  private noiseGateNode: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private stereoPannerNode: StereoPannerNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private latencyDelayNode: DelayNode | null = null;
  private masterGainNode: GainNode | null = null;

  // Analyzers for visualizers
  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;

  // Volume meter values
  private inputLevel: number = 0;
  private outputLevel: number = 0;

  // Internal noise gate envelope tracker
  private gateInterval: number | null = null;

  public initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /* ============================================================
     1. PURE TONE AUDIOMETRY GENERATOR
     ============================================================ */

  /**
   * Plays a calibrated pure tone for hearing threshold detection
   * @param frequency in Hz (250, 500, 1000, 2000, 4000, 8000)
   * @param dBHL Hearing Level in dB (0 to 80 dB HL)
   * @param ear 'left' (-1 pan) or 'right' (+1 pan)
   */
  public startTone(frequency: number, dBHL: number, ear: 'left' | 'right'): void {
    const ctx = this.initContext();
    this.stopTone();

    // Map dB HL (0 - 80 dB) to linear gain on computer audio (safe range -60 dBFS to -8 dBFS)
    // 0 dB HL ~ -55 dBFS; 80 dB HL ~ -8 dBFS
    const dBFS = -55 + (dBHL / 80) * 47;
    const linearGain = Math.pow(10, dBFS / 20);

    this.toneOsc = ctx.createOscillator();
    this.toneGain = ctx.createGain();
    this.tonePanner = ctx.createStereoPanner();

    this.toneOsc.type = 'sine';
    this.toneOsc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Pan strictly to selected ear
    this.tonePanner.pan.setValueAtTime(ear === 'left' ? -1.0 : 1.0, ctx.currentTime);

    // Smooth attack to avoid acoustic pop
    this.toneGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.toneGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, linearGain), ctx.currentTime + 0.05);

    this.toneOsc.connect(this.toneGain);
    this.toneGain.connect(this.tonePanner);
    this.tonePanner.connect(ctx.destination);

    this.toneOsc.start();
  }

  public stopTone(): void {
    if (this.toneGain && this.ctx) {
      try {
        const currentTime = this.ctx.currentTime;
        this.toneGain.gain.setValueAtTime(Math.max(0.0001, this.toneGain.gain.value), currentTime);
        this.toneGain.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.04);
        setTimeout(() => {
          if (this.toneOsc) {
            try {
              this.toneOsc.stop();
              this.toneOsc.disconnect();
            } catch {
              // Ignore if already stopped
            }
            this.toneOsc = null;
          }
        }, 50);
      } catch {
        // Fallback immediate stop
        if (this.toneOsc) {
          try {
            this.toneOsc.stop();
          } catch {
            // ignore
          }
          this.toneOsc = null;
        }
      }
    }
  }

  /**
   * Plays a triple pulsed tone: Beep - Pause - Beep - Pause - Beep
   * Clinical standard to distinguish true tone from tinnitus.
   */
  public playPulseTone(frequency: number, dBHL: number, ear: 'left' | 'right', onComplete?: () => void): void {
    const ctx = this.initContext();
    this.stopTone();

    const dBFS = -55 + (dBHL / 80) * 47;
    const linearGain = Math.max(0.0001, Math.pow(10, dBFS / 20));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    panner.pan.setValueAtTime(ear === 'left' ? -1.0 : 1.0, ctx.currentTime);

    const now = ctx.currentTime;
    const pulseLen = 0.22;
    const pauseLen = 0.12;

    gain.gain.setValueAtTime(0.0001, now);

    // Pulse 1
    gain.gain.exponentialRampToValueAtTime(linearGain, now + 0.02);
    gain.gain.setValueAtTime(linearGain, now + pulseLen);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + pulseLen + 0.02);

    // Pulse 2
    const p2Start = now + pulseLen + pauseLen;
    gain.gain.setValueAtTime(0.0001, p2Start);
    gain.gain.exponentialRampToValueAtTime(linearGain, p2Start + 0.02);
    gain.gain.setValueAtTime(linearGain, p2Start + pulseLen);
    gain.gain.exponentialRampToValueAtTime(0.0001, p2Start + pulseLen + 0.02);

    // Pulse 3
    const p3Start = p2Start + pulseLen + pauseLen;
    gain.gain.setValueAtTime(0.0001, p3Start);
    gain.gain.exponentialRampToValueAtTime(linearGain, p3Start + 0.02);
    gain.gain.setValueAtTime(linearGain, p3Start + pulseLen);
    gain.gain.exponentialRampToValueAtTime(0.0001, p3Start + pulseLen + 0.02);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    osc.start(now);
    const totalTime = p3Start + pulseLen + 0.05;
    osc.stop(totalTime);

    if (onComplete) {
      setTimeout(onComplete, (totalTime - now) * 1000);
    }
  }

  /* ============================================================
     2. REAL-TIME LIVE DSP PIPELINE
     ============================================================ */

  /**
   * Initializes and starts the audio processing graph
   */
  public async startDspStream(
    sourceType: 'mic' | 'sample_speech_noise' | 'sample_ambient_cafe' | 'sample_clean_voice',
    bandGains: { frequency: number; gainDb: number }[],
    options: {
      highPass: boolean;
      noiseReduction: 'off' | 'light' | 'moderate' | 'aggressive';
      noiseGateThreshold: number;
      simulatedBtLatencyMs: number;
      compressorEnabled: boolean;
      activeEar: EarSelection;
      masterVolume: number;
    }
  ): Promise<boolean> {
    const ctx = this.initContext();
    this.stopDspStream();

    try {
      // 1. Create Nodes
      this.inputAnalyser = ctx.createAnalyser();
      this.inputAnalyser.fftSize = 512;
      this.inputAnalyser.smoothingTimeConstant = 0.75;

      this.outputAnalyser = ctx.createAnalyser();
      this.outputAnalyser.fftSize = 512;
      this.outputAnalyser.smoothingTimeConstant = 0.75;

      this.highPassFilterNode = ctx.createBiquadFilter();
      this.highPassFilterNode.type = 'highpass';
      this.highPassFilterNode.frequency.setValueAtTime(options.highPass ? 130 : 20, ctx.currentTime);
      this.highPassFilterNode.Q.setValueAtTime(0.7, ctx.currentTime);

      this.noiseGateNode = ctx.createGain();
      this.noiseGateNode.gain.setValueAtTime(1.0, ctx.currentTime);

      // Create 6-band Biquad Equalizer
      this.eqFilters = bandGains.map((band) => {
        const filter = ctx.createBiquadFilter();
        if (band.frequency <= 250) {
          filter.type = 'lowshelf';
        } else if (band.frequency >= 8000) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.setValueAtTime(1.4, ctx.currentTime);
        }
        filter.frequency.setValueAtTime(band.frequency, ctx.currentTime);
        filter.gain.setValueAtTime(band.gainDb, ctx.currentTime);
        return filter;
      });

      this.stereoPannerNode = ctx.createStereoPanner();
      const panVal = options.activeEar === 'left' ? -0.8 : options.activeEar === 'right' ? 0.8 : 0.0;
      this.stereoPannerNode.pan.setValueAtTime(panVal, ctx.currentTime);

      this.compressorNode = ctx.createDynamicsCompressor();
      if (options.compressorEnabled) {
        this.compressorNode.threshold.setValueAtTime(-22, ctx.currentTime);
        this.compressorNode.knee.setValueAtTime(10, ctx.currentTime);
        this.compressorNode.ratio.setValueAtTime(5, ctx.currentTime);
        this.compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
        this.compressorNode.release.setValueAtTime(0.12, ctx.currentTime);
      } else {
        this.compressorNode.threshold.setValueAtTime(0, ctx.currentTime);
        this.compressorNode.ratio.setValueAtTime(1, ctx.currentTime);
      }

      this.latencyDelayNode = ctx.createDelay(1.0);
      this.latencyDelayNode.delayTime.setValueAtTime(options.simulatedBtLatencyMs / 1000, ctx.currentTime);

      this.masterGainNode = ctx.createGain();
      this.masterGainNode.gain.setValueAtTime(options.masterVolume, ctx.currentTime);

      // 2. Connect Source Node
      if (sourceType === 'mic') {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        this.mediaStream = stream;
        this.sourceNode = ctx.createMediaStreamSource(stream);
      } else {
        // Synthesize simulated acoustic environments
        this.sourceNode = this.createSyntheticSource(ctx, sourceType);
      }

      // 3. Assemble Audio Routing Graph:
      // Source -> Input Analyser -> HighPass -> NoiseGate -> [EQ Band 0..5] -> StereoPanner -> Compressor -> LatencyDelay -> MasterGain -> Output Analyser -> Destination
      let currentNode: AudioNode = this.sourceNode;

      currentNode.connect(this.inputAnalyser);
      this.inputAnalyser.connect(this.highPassFilterNode);
      currentNode = this.highPassFilterNode;

      currentNode.connect(this.noiseGateNode);
      currentNode = this.noiseGateNode;

      // Chain EQ bands
      for (const filter of this.eqFilters) {
        currentNode.connect(filter);
        currentNode = filter;
      }

      currentNode.connect(this.stereoPannerNode);
      this.stereoPannerNode.connect(this.compressorNode);
      this.compressorNode.connect(this.latencyDelayNode);
      this.latencyDelayNode.connect(this.masterGainNode);
      this.masterGainNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(ctx.destination);

      // 4. Start Noise Gate dynamic tracking loop
      this.startNoiseGateTracker(options.noiseReduction, options.noiseGateThreshold);

      this.isRunning = true;
      return true;
    } catch (err) {
      console.error('Audio engine start failed:', err);
      this.stopDspStream();
      return false;
    }
  }

  /**
   * Generates rich acoustic environments (Cafeteria chatter + speech, HVAC rumble, clean speech)
   * without needing external audio asset downloads.
   */
  private createSyntheticSource(
    ctx: AudioContext,
    type: 'sample_speech_noise' | 'sample_ambient_cafe' | 'sample_clean_voice'
  ): AudioNode {
    const merger = ctx.createChannelMerger(1);

    // 1. Noise Generator (Pink / Brownian noise)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    if (type === 'sample_speech_noise') {
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(950, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(0.8, ctx.currentTime);
      noiseGain.gain.setValueAtTime(0.25, ctx.currentTime);
    } else if (type === 'sample_ambient_cafe') {
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(450, ctx.currentTime);
      noiseGain.gain.setValueAtTime(0.35, ctx.currentTime);
    } else {
      // Clean voice - minimal background noise
      noiseGain.gain.setValueAtTime(0.01, ctx.currentTime);
    }

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(merger, 0, 0);
    noiseSource.start();

    // 2. Simulated Speech Formant Oscillator (vowel pulses mimicking conversation)
    const voiceOsc = ctx.createOscillator();
    voiceOsc.type = 'sawtooth';
    voiceOsc.frequency.setValueAtTime(140, ctx.currentTime); // Fund. freq 140 Hz

    const formantFilter1 = ctx.createBiquadFilter();
    formantFilter1.type = 'bandpass';
    formantFilter1.frequency.setValueAtTime(750, ctx.currentTime); // F1
    formantFilter1.Q.setValueAtTime(4.0, ctx.currentTime);

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.18, ctx.currentTime);

    voiceOsc.connect(formantFilter1);
    formantFilter1.connect(voiceGain);
    voiceGain.connect(merger, 0, 0);
    voiceOsc.start();

    // Speech rhythm cadence modulation
    let isVocalizing = true;
    const interval = window.setInterval(() => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      isVocalizing = !isVocalizing;
      const targetGain = isVocalizing ? (type === 'sample_ambient_cafe' ? 0.12 : 0.28) : 0.02;
      const targetFreq = 120 + Math.random() * 90;
      const targetF1 = 400 + Math.random() * 1200;

      if (ctx.state === 'running') {
        voiceGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
        voiceOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);
        formantFilter1.frequency.setTargetAtTime(targetF1, ctx.currentTime, 0.06);
      }
    }, 420);

    this.syntheticSourceTimer = interval;

    return merger;
  }

  /**
   * Dynamic software noise gate & suppression algorithm
   * Tracks RMS of input signal; applies downward expansion below threshold.
   */
  private startNoiseGateTracker(
    mode: 'off' | 'light' | 'moderate' | 'aggressive',
    thresholdDb: number
  ): void {
    if (mode === 'off' || !this.inputAnalyser || !this.noiseGateNode || !this.ctx) {
      if (this.noiseGateNode && this.ctx) {
        this.noiseGateNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
      }
      return;
    }

    const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount);
    const attenuation = mode === 'light' ? 0.35 : mode === 'moderate' ? 0.15 : 0.03;

    this.gateInterval = window.setInterval(() => {
      if (!this.inputAnalyser || !this.noiseGateNode || !this.ctx) return;

      this.inputAnalyser.getByteTimeDomainData(dataArray);

      // Compute RMS
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      const currentDb = 20 * Math.log10(Math.max(0.00001, rms));

      this.inputLevel = Math.max(0, (currentDb + 60) / 60);

      // Apply downward gate
      const targetGain = currentDb < thresholdDb ? attenuation : 1.0;
      this.noiseGateNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
    }, 30);
  }

  public updateDspParameters(
    bandGains: { frequency: number; gainDb: number }[],
    options: {
      highPass: boolean;
      noiseReduction: 'off' | 'light' | 'moderate' | 'aggressive';
      noiseGateThreshold: number;
      simulatedBtLatencyMs: number;
      compressorEnabled: boolean;
      activeEar: EarSelection;
      masterVolume: number;
    }
  ): void {
    if (!this.ctx || !this.isRunning) return;
    const ctx = this.ctx;

    // Update High-pass
    if (this.highPassFilterNode) {
      this.highPassFilterNode.frequency.setTargetAtTime(options.highPass ? 130 : 20, ctx.currentTime, 0.05);
    }

    // Update EQ Bands
    if (this.eqFilters.length === bandGains.length) {
      bandGains.forEach((band, idx) => {
        const filter = this.eqFilters[idx];
        if (filter) {
          filter.gain.setTargetAtTime(band.gainDb, ctx.currentTime, 0.05);
        }
      });
    }

    // Update Panning
    if (this.stereoPannerNode) {
      const panVal = options.activeEar === 'left' ? -0.8 : options.activeEar === 'right' ? 0.8 : 0.0;
      this.stereoPannerNode.pan.setTargetAtTime(panVal, ctx.currentTime, 0.05);
    }

    // Update Compressor
    if (this.compressorNode) {
      if (options.compressorEnabled) {
        this.compressorNode.threshold.setTargetAtTime(-22, ctx.currentTime, 0.05);
        this.compressorNode.ratio.setTargetAtTime(5, ctx.currentTime, 0.05);
      } else {
        this.compressorNode.threshold.setTargetAtTime(0, ctx.currentTime, 0.05);
        this.compressorNode.ratio.setTargetAtTime(1, ctx.currentTime, 0.05);
      }
    }

    // Update Simulated BT Latency
    if (this.latencyDelayNode) {
      this.latencyDelayNode.delayTime.setTargetAtTime(options.simulatedBtLatencyMs / 1000, ctx.currentTime, 0.05);
    }

    // Update Master Volume
    if (this.masterGainNode) {
      this.masterGainNode.gain.setTargetAtTime(options.masterVolume, ctx.currentTime, 0.05);
    }

    // Restart noise gate tracker with new threshold/mode
    if (this.gateInterval) {
      clearInterval(this.gateInterval);
      this.gateInterval = null;
    }
    this.startNoiseGateTracker(options.noiseReduction, options.noiseGateThreshold);
  }

  public stopDspStream(): void {
    this.isRunning = false;

    if (this.syntheticSourceTimer) {
      clearInterval(this.syntheticSourceTimer);
      this.syntheticSourceTimer = null;
    }

    if (this.gateInterval) {
      clearInterval(this.gateInterval);
      this.gateInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }

    this.eqFilters.forEach((f) => {
      try {
        f.disconnect();
      } catch {
        // ignore
      }
    });
    this.eqFilters = [];

    if (this.masterGainNode) {
      try {
        this.masterGainNode.disconnect();
      } catch {
        // ignore
      }
      this.masterGainNode = null;
    }
  }

  public getLevels(): { inputLevel: number; outputLevel: number } {
    if (!this.outputAnalyser) return { inputLevel: this.inputLevel, outputLevel: 0 };

    const dataArray = new Uint8Array(this.outputAnalyser.frequencyBinCount);
    this.outputAnalyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const db = 20 * Math.log10(Math.max(0.00001, rms));
    this.outputLevel = Math.max(0, (db + 60) / 60);

    return {
      inputLevel: this.inputLevel,
      outputLevel: this.outputLevel,
    };
  }
}

export const audioEngine = new AudioEngine();
