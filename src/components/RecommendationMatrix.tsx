import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Cpu, Zap, Radio, Clock, ShieldAlert, ArrowRight } from 'lucide-react';

interface RecommendationMatrixProps {
  onNavigateToDsp: () => void;
  onNavigateToHearingTest: () => void;
}

export const RecommendationMatrix: React.FC<RecommendationMatrixProps> = ({
  onNavigateToDsp,
  onNavigateToHearingTest,
}) => {
  // Latency Simulator State
  const [bufferSize, setBufferSize] = useState<number>(128); // samples (64, 128, 256, 512)
  const [sampleRate] = useState<number>(48000); // 48 kHz
  const [btCodec, setBtCodec] = useState<'ble_lc3' | 'asha' | 'aptx_ll' | 'a2dp_sbc' | 'sco'>('ble_lc3');
  const [dspComplexity, setDspComplexity] = useState<'minimal' | 'rnnoise' | 'spectral'>('spectral');

  // Compute Latency Components (in milliseconds)
  const bufferMs = Math.round(((bufferSize / sampleRate) * 1000) * 10) / 10;
  
  // DSP execution time
  const dspMs = dspComplexity === 'minimal' ? 1.2 : dspComplexity === 'spectral' ? 2.8 : 6.5;

  // Bluetooth encoding + RF transmission + headset buffer
  let btCodecMs = 20;
  let btDescription = '';
  switch (btCodec) {
    case 'ble_lc3':
      btCodecMs = 18;
      btDescription = 'Bluetooth 5.2+ LE Audio (LC3 Codec) - Ultra-low latency isochronous streams.';
      break;
    case 'asha':
      btCodecMs = 24;
      btDescription = 'Android ASHA (Audio Streaming for Hearing Aids) - Direct G.722 hearing aid protocol.';
      break;
    case 'aptx_ll':
      btCodecMs = 38;
      btDescription = 'Qualcomm aptX Low Latency - Requires proprietary hardware support.';
      break;
    case 'sco':
      btCodecMs = 45;
      btDescription = 'Bluetooth Hands-Free Profile (SCO) - Low latency but narrowband 8kHz/16kHz speech quality.';
      break;
    case 'a2dp_sbc':
      btCodecMs = 160;
      btDescription = 'Standard Bluetooth A2DP (SBC/AAC) - High quality for music, catastrophic for live pass-through.';
      break;
  }

  // Native Android total (Hardware ADC + Oboe double buffer + DSP + BT)
  const nativeTotalMs = Math.round((bufferMs * 2 + dspMs + btCodecMs) * 10) / 10;

  // Flutter overhead: Dart isolate event loop, FFI marshalling, and GC latency
  const flutterOverheadMs = 42;
  const flutterTotalMs = Math.round((nativeTotalMs + flutterOverheadMs) * 10) / 10;

  // Psychoacoustic evaluation
  let latencyStatus: { label: string; color: string; desc: string };
  if (nativeTotalMs <= 28) {
    latencyStatus = {
      label: 'Transparent Hearing Aid Range (< 28ms)',
      color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20',
      desc: 'Speech is natural. Comb-filtering between bone-conduction and headset speaker is inaudible.',
    };
  } else if (nativeTotalMs <= 50) {
    latencyStatus = {
      label: 'Noticeable Barrel Effect (28ms - 50ms)',
      color: 'text-amber-400 border-amber-500/40 bg-amber-950/20',
      desc: 'Hollow, phased acoustic echo when user speaks their own voice, though remote sounds are usable.',
    };
  } else {
    latencyStatus = {
      label: 'Speech Jammer Effect (> 50ms)',
      color: 'text-rose-400 border-rose-500/40 bg-rose-950/20',
      desc: 'Severe delay disrupts natural speech cadence. Brain cannot speak while hearing delayed echo.',
    };
  }

  return (
    <div className="space-y-10 py-2">
      {/* 1. Definitive Executive Summary Card */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              Engineering Verdict & Framework Selection
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              Recommendation: Native Android (Kotlin + C++ Oboe)
            </h2>
            <p className="text-sm lg:text-base text-slate-300 max-w-3xl leading-relaxed">
              For a real-time microphone pass-through app with Active Noise Cancellation (ANC) and hearing compensation,{' '}
              <strong className="text-white font-semibold">Native Android is strongly superior</strong>. Flutter is fundamentally unsuitable for real-time live pass-through audio due to acoustic latency physics, garbage collection pauses, and lack of direct low-level Bluetooth ASHA/LE Audio hardware hooks.
            </p>
          </div>

          <div className="shrink-0 bg-cyan-950/60 border border-cyan-500/30 rounded-lg p-4 text-center min-w-[200px]">
            <div className="text-xs text-cyan-300 font-medium">Recommended Stack</div>
            <div className="text-lg font-bold text-white mt-1">Kotlin + C++ NDK</div>
            <div className="text-xs text-cyan-400/80 mt-1">Google Oboe / AAudio</div>
          </div>
        </div>

        {/* 3 Core Reasons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>1. The Comb-Filter Threshold</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When a user speaks while wearing a headset, sound travels into their cochlea via bone conduction in ~2ms. If the microphone-to-headset delay exceeds 20–25ms, it triggers the acoustic <strong className="text-slate-200">comb-filter echo</strong> and <strong className="text-slate-200">speech-jammer effect</strong>. Only Native C++ Oboe on exclusive streams can hit sub-10ms device latency.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>2. Zero-GC Audio Callback Thread</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Audio callbacks occur every 2.6ms (128 samples at 48kHz). Dart (Flutter) runs garbage collection and passes buffers across isolate/FFI threads, causing buffer underruns (audible pops and clicks). Native C++ runs <strong className="text-slate-200">zero-allocation real-time loops</strong> directly on the Linux audio thread.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>3. Bluetooth ASHA & LE Audio APIs</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard Bluetooth A2DP has 150–250ms latency (unusable for live voice). Android 13+ provides native APIs for <strong className="text-slate-200">ASHA (Audio Streaming for Hearing Aids)</strong> and <strong className="text-slate-200">BLE Audio LC3</strong> (<code className="text-cyan-300 font-mono text-[11px]">AudioDeviceInfo.TYPE_BLE_HEADSET</code>). Flutter has no mature plugins for these low-level routing protocols.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Interactive Round-Trip Latency (RTL) Budget Calculator */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Acoustic Physics Simulator
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Round-Trip Audio Latency (RTL) Calculator
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Mic Input ADC → Audio Engine Buffer → Noise Cancelling DSP → Hearing EQ → Bluetooth Codec → BT Headset DAC
            </p>
          </div>

          {/* Verdict Badge */}
          <div className={`px-3 py-2 rounded-lg border text-xs font-semibold ${latencyStatus.color}`}>
            {latencyStatus.label}
          </div>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/60 p-5 rounded-lg border border-slate-800/80">
          {/* Buffer Size */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Oboe Buffer Size</span>
              <span className="text-cyan-400 font-mono font-semibold">{bufferSize} samples ({bufferMs} ms)</span>
            </div>
            <div className="flex items-center gap-2">
              {[64, 128, 256, 512].map((size) => (
                <button
                  key={size}
                  onClick={() => setBufferSize(size)}
                  className={`flex-1 py-1.5 text-xs font-mono font-medium rounded border transition-colors ${
                    bufferSize === size
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500 block">
              Lower buffer reduces latency but requires strict real-time C++ execution.
            </span>
          </div>

          {/* DSP Algorithm */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Noise Reduction DSP</span>
              <span className="text-cyan-400 font-mono font-semibold">{dspMs} ms</span>
            </div>
            <select
              value={dspComplexity}
              onChange={(e) => setDspComplexity(e.target.value as 'minimal' | 'rnnoise' | 'spectral')}
              aria-label="Noise Reduction DSP Algorithm"
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded p-2 focus:border-cyan-500 focus:outline-none"
            >
              <option value="minimal">Minimal: 6-Band Biquad Filter Bank (1.2 ms)</option>
              <option value="spectral">Spectral Subtraction + Dynamic Gate (2.8 ms)</option>
              <option value="rnnoise">Neural RNNoise / WebRTC NS (6.5 ms)</option>
            </select>
            <span className="text-[11px] text-slate-500 block">
              Higher quality spectral noise cancellation requires FFT block windowing.
            </span>
          </div>

          {/* Bluetooth Codec */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Bluetooth Profile & Codec</span>
              <span className="text-cyan-400 font-mono font-semibold">{btCodecMs} ms</span>
            </div>
            <select
              value={btCodec}
              onChange={(e) => setBtCodec(e.target.value as 'ble_lc3' | 'asha' | 'aptx_ll' | 'a2dp_sbc' | 'sco')}
              aria-label="Bluetooth Profile & Codec"
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded p-2 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ble_lc3">BLE Audio LC3 (18 ms) - Android 13+ Recommended</option>
              <option value="asha">Android ASHA Hearing Aid (24 ms)</option>
              <option value="aptx_ll">aptX Low Latency (38 ms)</option>
              <option value="sco">Bluetooth Hands-Free SCO (45 ms)</option>
              <option value="a2dp_sbc">Standard A2DP SBC/AAC (160 ms)</option>
            </select>
            <span className="text-[11px] text-slate-500 block truncate" title={btDescription}>
              {btDescription}
            </span>
          </div>
        </div>

        {/* Latency Comparison Visual Bar */}
        <div className="space-y-4 pt-2">
          {/* Native Android Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Native Android (Kotlin + C++ Oboe)
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm tabular-nums">
                {nativeTotalMs} ms RTL
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
              <div
                style={{ width: `${Math.min(100, (bufferMs * 2 / 200) * 100)}%` }}
                className="bg-cyan-500 h-full"
                title={`Buffer: ${bufferMs * 2}ms`}
              />
              <div
                style={{ width: `${Math.min(100, (dspMs / 200) * 100)}%` }}
                className="bg-purple-500 h-full"
                title={`DSP: ${dspMs}ms`}
              />
              <div
                style={{ width: `${Math.min(100, (btCodecMs / 200) * 100)}%` }}
                className="bg-emerald-500 h-full"
                title={`Bluetooth: ${btCodecMs}ms`}
              />
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> Audio I/O Buffer ({bufferMs * 2}ms)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> C++ DSP Processing ({dspMs}ms)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Bluetooth RF & Codec ({btCodecMs}ms)
              </span>
            </div>
          </div>

          {/* Flutter Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                Flutter (Dart Event Loop + MethodChannel / FFI Marshalling)
              </span>
              <span className="font-mono font-bold text-rose-400 text-sm tabular-nums">
                {flutterTotalMs} ms RTL (+{flutterOverheadMs}ms penalty)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
              <div
                style={{ width: `${Math.min(100, (nativeTotalMs / 200) * 100)}%` }}
                className="bg-rose-500/50 h-full"
              />
              <div
                style={{ width: `${Math.min(100, (flutterOverheadMs / 200) * 100)}%` }}
                className="bg-rose-500 h-full animate-pulse"
                title="Dart FFI + Isolate + GC latency"
              />
            </div>
            <span className="text-[11px] text-rose-400/90">
              Flutter adds 35–50ms unavoidable thread-crossing and Dart VM garbage-collection jitter.
            </span>
          </div>
        </div>

        {/* Latency Interpretation */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">Psychoacoustic Reality:</strong> {latencyStatus.desc}
          </p>
        </div>
      </section>

      {/* 3. Deep Architectural Matrix (Table) */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 lg:p-8 space-y-6">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Detailed Framework Evaluation
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            Native Android vs. Flutter Comparison Matrix
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Evaluation Criteria</th>
                <th className="py-3 px-4 text-emerald-400">Native Android (Kotlin + C++ NDK)</th>
                <th className="py-3 px-4 text-rose-400">Flutter (Dart / FFI)</th>
                <th className="py-3 px-4">Impact on Your App</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr className="hover:bg-slate-800/20">
                <td className="py-3 px-4 font-medium text-white">Audio Latency (RTL)</td>
                <td className="py-3 px-4 text-emerald-400 font-mono font-medium">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>8ms – 28ms (AAudio / Oboe)</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-rose-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>65ms – 140ms+ (Dart FFI)</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400">
                  Critical. High latency causes speech jamming when user speaks.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/20">
                <td className="py-3 px-4 font-medium text-white">Garbage Collection Pauses</td>
                <td className="py-3 px-4 text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Zero in C++ callback thread</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-rose-400">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>Periodic Dart isolate GC stops</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400">
                  GC pauses cause buffer underruns, producing loud pops and dropouts.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/20">
                <td className="py-3 px-4 font-medium text-white">Bluetooth ASHA & LE Audio</td>
                <td className="py-3 px-4 text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Direct Android 13/14+ AudioManager APIs</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-amber-400">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>No official plugin; custom bridge needed</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400">
                  Required to route audio to Bluetooth hearing aids and low-latency headsets.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/20">
                <td className="py-3 px-4 font-medium text-white">DSP & Noise Cancellation</td>
                <td className="py-3 px-4 text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Native C++ (RNNoise, WebRTC NS, ARM NEON)</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-rose-400">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>Must write C++ anyway & bridge via FFI</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400">
                  Real-time spectral noise cancellation requires raw SIMD performance.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/20">
                <td className="py-3 px-4 font-medium text-white">Background Mic Streaming</td>
                <td className="py-3 px-4 text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Full ForegroundService with FOREGROUND_SERVICE_MICROPHONE</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-amber-400">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Complex Android 14 policy workarounds</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400">
                  The app must keep streaming when screen is locked or in background.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/20">
                <td className="py-3 px-4 font-medium text-white">Audiogram Hearing Test Engine</td>
                <td className="py-3 px-4 text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Direct hardware volume calibration</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Good for UI curves, but audio is abstracted</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400">
                  Accurate calibration requires bypass of Android volume limiters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            Ready to test hearing loss curves or hear live DSP noise cancellation in action?
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToHearingTest}
              className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Explore Hearing Test</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onNavigateToDsp}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-500/20"
            >
              <span>Test Live Audio DSP</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
