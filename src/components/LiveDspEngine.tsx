import React, { useEffect, useRef, useState } from 'react';
import { AudiogramData, DspState, EarSelection } from '../types/audio';
import { calculatePrescriptionGains } from '../utils/audiologyFormula';
import { audioEngine } from '../utils/audioEngine';
import { Mic, MicOff, Volume2, ShieldCheck, Sliders, RefreshCw, AlertTriangle, Radio, Activity } from 'lucide-react';

interface LiveDspEngineProps {
  audiogram: AudiogramData;
  activeEar: EarSelection;
  setActiveEar: (ear: EarSelection) => void;
}

export const LiveDspEngine: React.FC<LiveDspEngineProps> = ({
  audiogram,
  activeEar,
  setActiveEar,
}) => {
  // DSP Configuration State
  const [dspState, setDspState] = useState<DspState>({
    isStreaming: false,
    audioSource: 'sample_speech_noise',
    noiseReductionLevel: 'moderate',
    noiseGateThreshold: -42,
    highPassFilter: true,
    eqEnabled: true,
    activeEar: activeEar,
    simulatedBtLatencyMs: 25,
    compressorEnabled: true,
    masterVolume: 1.0,
  });

  // Calculate current EQ band gains from audiogram
  const relevantLosses =
    activeEar === 'left'
      ? audiogram.leftEar
      : activeEar === 'right'
      ? audiogram.rightEar
      : audiogram.rightEar;

  const [bandGains, setBandGains] = useState<{ frequency: number; gainDb: number }[]>(() =>
    calculatePrescriptionGains(relevantLosses)
  );

  // Sync EQ gains whenever audiogram or ear changes
  const handleSyncWithAudiogram = () => {
    const newGains = calculatePrescriptionGains(relevantLosses);
    setBandGains(newGains);
    if (dspState.isStreaming) {
      audioEngine.updateDspParameters(newGains, {
        highPass: dspState.highPassFilter,
        noiseReduction: dspState.noiseReductionLevel,
        noiseGateThreshold: dspState.noiseGateThreshold,
        simulatedBtLatencyMs: dspState.simulatedBtLatencyMs,
        compressorEnabled: dspState.compressorEnabled,
        activeEar: dspState.activeEar,
        masterVolume: dspState.masterVolume,
      });
    }
  };

  const handleGainChange = (frequency: number, val: number) => {
    const updated = bandGains.map((b) => (b.frequency === frequency ? { ...b, gainDb: val } : b));
    setBandGains(updated);
    if (dspState.isStreaming) {
      audioEngine.updateDspParameters(updated, {
        highPass: dspState.highPassFilter,
        noiseReduction: dspState.noiseReductionLevel,
        noiseGateThreshold: dspState.noiseGateThreshold,
        simulatedBtLatencyMs: dspState.simulatedBtLatencyMs,
        compressorEnabled: dspState.compressorEnabled,
        activeEar: dspState.activeEar,
        masterVolume: dspState.masterVolume,
      });
    }
  };

  // Toggle Live Streaming
  const handleToggleStream = async () => {
    if (dspState.isStreaming) {
      audioEngine.stopDspStream();
      setDspState((prev) => ({ ...prev, isStreaming: false }));
    } else {
      const success = await audioEngine.startDspStream(dspState.audioSource, bandGains, {
        highPass: dspState.highPassFilter,
        noiseReduction: dspState.noiseReductionLevel,
        noiseGateThreshold: dspState.noiseGateThreshold,
        simulatedBtLatencyMs: dspState.simulatedBtLatencyMs,
        compressorEnabled: dspState.compressorEnabled,
        activeEar: dspState.activeEar,
        masterVolume: dspState.masterVolume,
      });
      if (success) {
        setDspState((prev) => ({ ...prev, isStreaming: true }));
      }
    }
  };

  // Parameter updates during active streaming
  const updateParameter = <K extends keyof DspState>(key: K, value: DspState[K]) => {
    const nextState = { ...dspState, [key]: value };
    setDspState(nextState);

    if (dspState.isStreaming) {
      // If switching audio source, restart stream
      if (key === 'audioSource') {
        audioEngine.stopDspStream();
        audioEngine.startDspStream(value as DspState['audioSource'], bandGains, {
          highPass: nextState.highPassFilter,
          noiseReduction: nextState.noiseReductionLevel,
          noiseGateThreshold: nextState.noiseGateThreshold,
          simulatedBtLatencyMs: nextState.simulatedBtLatencyMs,
          compressorEnabled: nextState.compressorEnabled,
          activeEar: nextState.activeEar,
          masterVolume: nextState.masterVolume,
        });
      } else {
        audioEngine.updateDspParameters(bandGains, {
          highPass: nextState.highPassFilter,
          noiseReduction: nextState.noiseReductionLevel,
          noiseGateThreshold: nextState.noiseGateThreshold,
          simulatedBtLatencyMs: nextState.simulatedBtLatencyMs,
          compressorEnabled: nextState.compressorEnabled,
          activeEar: nextState.activeEar,
          masterVolume: nextState.masterVolume,
        });
      }
    }
  };

  // Visualizer Canvas & Levels Loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [vuLevels, setVuLevels] = useState<{ input: number; output: number }>({ input: 0, output: 0 });

  useEffect(() => {
    let animId: number;

    const renderSpectrum = () => {
      if (canvasRef.current && dspState.isStreaming) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;

          ctx.clearRect(0, 0, width, height);

          // Draw frequency grid lines
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          for (let f = 1; f <= 5; f++) {
            const x = (f / 6) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }

          // 1. Draw Input Spectrum (Muted Green)
          if (audioEngine.inputAnalyser) {
            const bufferLen = audioEngine.inputAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLen);
            audioEngine.inputAnalyser.getByteFrequencyData(dataArray);

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
            ctx.lineWidth = 2;

            for (let i = 0; i < bufferLen; i++) {
              const x = (i / bufferLen) * width;
              const v = dataArray[i] / 255;
              const y = height - v * height;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }

          // 2. Draw Processed Output Spectrum (Bright Cyan)
          if (audioEngine.outputAnalyser) {
            const bufferLen = audioEngine.outputAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLen);
            audioEngine.outputAnalyser.getByteFrequencyData(dataArray);

            ctx.beginPath();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 2.5;

            for (let i = 0; i < bufferLen; i++) {
              const x = (i / bufferLen) * width;
              const v = dataArray[i] / 255;
              const y = height - v * height;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
      }

      if (dspState.isStreaming) {
        const levels = audioEngine.getLevels();
        setVuLevels({ input: levels.inputLevel, output: levels.outputLevel });
      } else {
        setVuLevels({ input: 0, output: 0 });
      }

      animId = requestAnimationFrame(renderSpectrum);
    };

    renderSpectrum();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [dspState.isStreaming]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      audioEngine.stopDspStream();
    };
  }, []);

  return (
    <div className="space-y-8 py-2">
      {/* 1. Master Control Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="space-y-1 w-full lg:w-auto">
          <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Real-Time DSP Signal Pipeline
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Live Noise Cancellation & Frequency Compensation
          </h2>
          <p className="text-xs text-slate-400">
            Real-time Web Audio pipeline executing high-pass rumble filtering, spectral noise gating, 6-band audiometric peaking EQ, and dynamic compression.
          </p>
        </div>

        {/* Start / Stop Stream Button */}
        <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
          <button
            onClick={handleToggleStream}
            className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg ${
              dspState.isStreaming
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-400/20'
            }`}
          >
            {dspState.isStreaming ? (
              <>
                <MicOff className="w-5 h-5" />
                <span>Stop Audio Stream</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span>Start Real-Time Stream</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Headphone Advice Banner */}
      {dspState.audioSource === 'mic' && (
        <div className="bg-amber-950/30 border border-amber-500/40 p-4 rounded-xl flex items-center gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            <strong className="text-white">Acoustic Feedback Warning:</strong> When using your live microphone, wear headphones or earphones. If computer speakers play microphone audio directly, it will cause an acoustic feedback loop squeal!
          </span>
        </div>
      )}

      {/* 2. Visualizer & Spectrum Panel */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Real-Time FFT Spectrum Visualizer</span>
            </h3>
            <span className="text-xs text-slate-400">
              Comparing raw input signal against processed, noise-suppressed, and frequency-compensated output
            </span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block"></span> Raw Input Spectrum
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span> Compensated Output
            </span>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="w-full h-44 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={800}
            height={176}
            className="w-full h-full block"
          />

          {!dspState.isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-xs bg-slate-950/80">
              <Mic className="w-6 h-6 mb-2 opacity-50" />
              <span>Audio stream is idle. Click "Start Real-Time Stream" above to activate live DSP.</span>
            </div>
          )}
        </div>

        {/* VU Meters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Input Meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Input Level (Mic / Synthetic)</span>
              <span className="text-emerald-400 tabular-nums">
                {dspState.isStreaming ? `${Math.round(vuLevels.input * 100)}%` : '0%'}
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                style={{ width: `${Math.min(100, vuLevels.input * 100)}%` }}
                className="bg-emerald-400 h-full transition-all duration-75"
              />
            </div>
          </div>

          {/* Output Meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Output Level (Compensated & Limited)</span>
              <span className="text-cyan-400 tabular-nums">
                {dspState.isStreaming ? `${Math.round(vuLevels.output * 100)}%` : '0%'}
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                style={{ width: `${Math.min(100, vuLevels.output * 100)}%` }}
                className="bg-cyan-400 h-full transition-all duration-75"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Controls Grid: DSP Noise Reduction + 6-Band Hearing Equalizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Noise Cancellation & Signal Routing (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-bold text-white tracking-tight pb-2 border-b border-slate-800">
              Signal Routing & Noise Cancelling DSP
            </h3>

            {/* Audio Source Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Audio Source</label>
              <select
                value={dspState.audioSource}
                onChange={(e) => updateParameter('audioSource', e.target.value as DspState['audioSource'])}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg p-2.5 focus:border-cyan-500 focus:outline-none"
              >
                <option value="sample_speech_noise">Synthetic: Speech in Cafeteria Noise (Recommended for test)</option>
                <option value="sample_ambient_cafe">Synthetic: Speech with Low-Frequency HVAC Rumble</option>
                <option value="sample_clean_voice">Synthetic: Clean Conversational Voice</option>
                <option value="mic">Live Device Microphone (Requires Headphones!)</option>
              </select>
            </div>

            {/* Noise Cancelling Level */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Noise Reduction Level</span>
                <span className="text-cyan-400 font-semibold uppercase">{dspState.noiseReductionLevel}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['off', 'light', 'moderate', 'aggressive'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => updateParameter('noiseReductionLevel', lvl)}
                    className={`py-2 text-xs font-semibold rounded-md border transition-colors capitalize ${
                      dspState.noiseReductionLevel === lvl
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 block">
                Controls downward spectral gate attenuation threshold.
              </span>
            </div>

            {/* High Pass Rumble Filter */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-white">High-Pass Rumble Filter (130 Hz)</div>
                <div className="text-[11px] text-slate-400">Eliminates wind, mechanical vibration & mic handling noise</div>
              </div>
              <button
                onClick={() => updateParameter('highPassFilter', !dspState.highPassFilter)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  dspState.highPassFilter ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    dspState.highPassFilter ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Safety Dynamic Limiter */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Dynamic Compression & Limiter</div>
                  <div className="text-[11px] text-slate-400">Protects ear from acoustic shock when high gains are active</div>
                </div>
              </div>
              <button
                onClick={() => updateParameter('compressorEnabled', !dspState.compressorEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  dspState.compressorEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    dspState.compressorEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Simulated Bluetooth Latency Delay */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Simulated Bluetooth Latency Buffer</span>
                </span>
                <span className="text-cyan-400 font-mono font-semibold">
                  {dspState.simulatedBtLatencyMs} ms
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                {[
                  { ms: 0, label: '0ms (Wired)' },
                  { ms: 25, label: '25ms (BLE/ASHA)' },
                  { ms: 60, label: '60ms (aptX)' },
                  { ms: 180, label: '180ms (A2DP)' },
                ].map((item) => (
                  <button
                    key={item.ms}
                    onClick={() => updateParameter('simulatedBtLatencyMs', item.ms)}
                    className={`py-2 text-[11px] rounded-md border transition-colors ${
                      dspState.simulatedBtLatencyMs === item.ms
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 block">
                Toggle to 180ms while speaking to experience the devastating "speech jammer" effect of standard Bluetooth A2DP!
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: 6-Band Frequency Compensation Equalizer (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>6-Band Hearing Loss Compensation Equalizer</span>
                </h3>
                <span className="text-xs text-slate-400">
                  Target gains calculated to restore speech consonant clarity (2kHz - 8kHz)
                </span>
              </div>

              {/* Sync With Audiogram Button */}
              <button
                onClick={handleSyncWithAudiogram}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Re-Sync from Audiogram</span>
              </button>
            </div>

            {/* 6 Band Sliders */}
            <div className="grid grid-cols-6 gap-3 pt-2">
              {bandGains.map((band) => (
                <div key={band.frequency} className="flex flex-col items-center space-y-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <span className="text-xs font-mono font-semibold text-cyan-400 tabular-nums">
                    {band.gainDb >= 0 ? `+${band.gainDb}` : band.gainDb} dB
                  </span>

                  {/* Vertical Range Slider */}
                  <div className="h-44 flex items-center justify-center">
                    <input
                      type="range"
                      min="-12"
                      max="24"
                      step="1"
                      value={band.gainDb}
                      onChange={(e) => handleGainChange(band.frequency, parseFloat(e.target.value))}
                      className="w-36 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 -rotate-90"
                    />
                  </div>

                  <div className="text-center space-y-0.5">
                    <div className="text-xs font-bold text-white font-mono">
                      {band.frequency >= 1000 ? `${band.frequency / 1000}k` : band.frequency}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-tighter">
                      {band.frequency <= 500 ? 'Bass' : band.frequency <= 2000 ? 'Mid' : 'Presence'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Master Volume */}
            <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Master Output Volume</div>
                  <div className="text-[11px] text-slate-400">Overall digital headroom gain</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.2"
                  max="1.5"
                  step="0.05"
                  value={dspState.masterVolume}
                  onChange={(e) => updateParameter('masterVolume', parseFloat(e.target.value))}
                  className="w-32 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <span className="text-xs font-mono text-cyan-400 tabular-nums w-10 text-right">
                  {Math.round(dspState.masterVolume * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
