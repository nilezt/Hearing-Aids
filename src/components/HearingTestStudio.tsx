import React, { useState } from 'react';
import { AudiogramData, EarSelection } from '../types/audio';
import { STANDARD_FREQUENCIES, AUDIOGRAM_PRESETS, assessAudiogram } from '../utils/audiologyFormula';
import { audioEngine } from '../utils/audioEngine';
import { Play, Square, Volume2, ArrowRight, RotateCcw, Sparkles, Check, HelpCircle } from 'lucide-react';

interface HearingTestStudioProps {
  audiogram: AudiogramData;
  setAudiogram: React.Dispatch<React.SetStateAction<AudiogramData>>;
  onApplyToDsp: () => void;
}

export const HearingTestStudio: React.FC<HearingTestStudioProps> = ({
  audiogram,
  setAudiogram,
  onApplyToDsp,
}) => {
  const [activeEar, setActiveEar] = useState<'left' | 'right'>('right');
  const [testMode, setTestMode] = useState<'interactive' | 'manual'>('interactive');

  // Interactive Test State
  const [currentFreqIdx, setCurrentFreqIdx] = useState<number>(2); // Start at 1000 Hz (standard clinical baseline)
  const [currentVolumeDb, setCurrentVolumeDb] = useState<number>(30); // Start at 30 dB HL
  const [isPlayingTone, setIsPlayingTone] = useState<boolean>(false);
  const [testCompleted, setTestCompleted] = useState<boolean>(false);

  const currentFreq = STANDARD_FREQUENCIES[currentFreqIdx];

  // Clinical Assessments
  const leftAssessment = assessAudiogram(audiogram.leftEar);
  const rightAssessment = assessAudiogram(audiogram.rightEar);
  const currentAssessment = activeEar === 'left' ? leftAssessment : rightAssessment;

  // Pure Tone Audio Handlers
  const handlePlayPulse = () => {
    setIsPlayingTone(true);
    audioEngine.playPulseTone(currentFreq, currentVolumeDb, activeEar, () => {
      setIsPlayingTone(false);
    });
  };

  const handleStartContinuousTone = () => {
    setIsPlayingTone(true);
    audioEngine.startTone(currentFreq, currentVolumeDb, activeEar);
  };

  const handleStopContinuousTone = () => {
    setIsPlayingTone(false);
    audioEngine.stopTone();
  };

  // Hughson-Westlake threshold determination: "I heard it" decreases volume by 10dB; "Can't hear" increases by 5dB
  const handleResponseHeard = () => {
    const newVol = Math.max(0, currentVolumeDb - 10);
    setCurrentVolumeDb(newVol);
    updateAudiogramThreshold(currentFreq, currentVolumeDb);
  };

  const handleResponseNotHeard = () => {
    const newVol = Math.min(85, currentVolumeDb + 5);
    setCurrentVolumeDb(newVol);
  };

  const updateAudiogramThreshold = (freq: number, val: number) => {
    setAudiogram((prev) => {
      const earKey = activeEar === 'left' ? 'leftEar' : 'rightEar';
      const updated = prev[earKey].map((item) =>
        item.frequency === freq ? { ...item, dBHL: val } : item
      );
      return { ...prev, [earKey]: updated };
    });
  };

  const handleNextFrequency = () => {
    if (currentFreqIdx < STANDARD_FREQUENCIES.length - 1) {
      setCurrentFreqIdx((prev) => prev + 1);
      setCurrentVolumeDb(30);
    } else {
      if (activeEar === 'right') {
        setActiveEar('left');
        setCurrentFreqIdx(0);
        setCurrentVolumeDb(30);
      } else {
        setTestCompleted(true);
      }
    }
  };

  const handleResetTest = () => {
    setCurrentFreqIdx(0);
    setCurrentVolumeDb(30);
    setTestCompleted(false);
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = AUDIOGRAM_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setAudiogram(preset.data);
    }
  };

  // Audiogram SVG coordinates helpers
  const svgWidth = 560;
  const svgHeight = 360;
  const padding = { top: 35, right: 35, bottom: 45, left: 55 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Inverted Y-axis: -10 dB HL at top (0), 100 dB HL at bottom (graphHeight)
  const minDb = -10;
  const maxDb = 100;
  const getX = (idx: number) => padding.left + (idx / (STANDARD_FREQUENCIES.length - 1)) * graphWidth;
  const getY = (db: number) => padding.top + ((db - minDb) / (maxDb - minDb)) * graphHeight;

  // Build SVG path strings
  const getPath = (data: { frequency: number; dBHL: number }[]) => {
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.dBHL)}`)
      .join(' ');
  };

  return (
    <div className="space-y-8 py-2">
      {/* 1. Header & Ear Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-xl border border-slate-800">
        <div>
          <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Clinical Pure Tone Audiometry (PTA)
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Hearing Threshold Measurement & Calibration
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Measures your minimum audible decibel threshold across standard speech frequencies (250 Hz – 8000 Hz). The results are converted via the audiological Half-Gain Rule into real-time equalization filters for your Bluetooth headset.
          </p>
        </div>

        {/* Ear Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveEar('left')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors flex items-center gap-2 cursor-pointer ${
              activeEar === 'left'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
            <span>Left Ear (Blue ✕)</span>
          </button>
          <button
            onClick={() => setActiveEar('right')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors flex items-center gap-2 cursor-pointer ${
              activeEar === 'right'
                ? 'bg-rose-600/20 text-rose-400 border border-rose-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            <span>Right Ear (Red ◯)</span>
          </button>
        </div>
      </div>

      {/* 2. Main Studio Grid: Interactive Test vs. Audiogram Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Test Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-6">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300">Testing Mode</span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-xs">
                <button
                  onClick={() => setTestMode('interactive')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    testMode === 'interactive'
                      ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  Interactive Guided
                </button>
                <button
                  onClick={() => setTestMode('manual')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    testMode === 'manual'
                      ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  Manual Sliders
                </button>
              </div>
            </div>

            {testMode === 'interactive' ? (
              /* Guided Test Interface */
              <div className="space-y-6">
                {/* Current Frequency Banner */}
                <div className="bg-slate-950/80 p-5 rounded-lg border border-slate-800/80 text-center space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    Current Frequency ({activeEar.toUpperCase()} EAR)
                  </span>
                  <div className="text-3xl font-mono font-bold text-white tracking-tight">
                    {currentFreq >= 1000 ? `${currentFreq / 1000} kHz` : `${currentFreq} Hz`}
                  </div>
                  <div className="text-xs text-cyan-400 font-mono">
                    Current Level: {currentVolumeDb} dB HL
                  </div>
                </div>

                {/* Tone Trigger Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handlePlayPulse}
                    disabled={isPlayingTone}
                    className={`py-3 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isPlayingTone
                        ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Play Pulse Tone</span>
                  </button>

                  <button
                    onMouseDown={handleStartContinuousTone}
                    onMouseUp={handleStopContinuousTone}
                    onTouchStart={handleStartContinuousTone}
                    onTouchEnd={handleStopContinuousTone}
                    className="py-3 px-4 rounded-lg font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 cursor-pointer active:bg-cyan-900/40"
                  >
                    <Play className="w-4 h-4" />
                    <span>Hold for Tone</span>
                  </button>
                </div>

                {/* Patient Response Buttons */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] text-slate-400 block font-medium">
                    Do you hear the pure tone in your {activeEar} ear?
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleResponseHeard}
                      className="py-2.5 px-3 bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-900/40 text-emerald-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Yes, I Heard It (-10dB)</span>
                    </button>
                    <button
                      onClick={handleResponseNotHeard}
                      className="py-2.5 px-3 bg-slate-800/80 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Inaudible (+5dB)</span>
                    </button>
                  </div>
                </div>

                {/* Confirm & Next Step */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400">
                    Step {currentFreqIdx + 1} of {STANDARD_FREQUENCIES.length} ({activeEar} ear)
                  </div>
                  <button
                    onClick={handleNextFrequency}
                    className="px-4 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Confirm & Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Manual Sliders Mode */
              <div className="space-y-4">
                <span className="text-xs text-slate-400 block">
                  Adjust individual frequency hearing thresholds directly (0 dB HL = normal; 60 dB HL = moderate loss):
                </span>
                <div className="space-y-3">
                  {STANDARD_FREQUENCIES.map((freq, idx) => {
                    const earList = activeEar === 'left' ? audiogram.leftEar : audiogram.rightEar;
                    const lossItem = earList.find((l) => l.frequency === freq) || { frequency: freq, dBHL: 10 };
                    return (
                      <div key={freq} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-mono font-medium">
                            {freq >= 1000 ? `${freq / 1000}k` : freq} Hz
                          </span>
                          <span className="text-cyan-400 font-mono tabular-nums font-semibold">
                            {lossItem.dBHL} dB HL
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="80"
                          step="5"
                          value={lossItem.dBHL}
                          onChange={(e) => updateAudiogramThreshold(freq, parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Clinical Presets Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Load Clinical Hearing Loss Presets</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AUDIOGRAM_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.id)}
                  className="p-2.5 text-left rounded-lg border border-slate-800 bg-slate-950/60 hover:border-slate-700 transition-colors text-xs space-y-1 cursor-pointer"
                >
                  <div className="font-semibold text-white truncate">{preset.name}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                    {preset.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Audiogram Graph & Frequency Compensation Formula (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Clinical Audiogram SVG Visualizer */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Standard Clinical Audiogram Plot
                </h3>
                <span className="text-xs text-slate-400">
                  Inverted dB HL scale: lower points indicate greater hearing loss
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-blue-400 flex items-center gap-1.5">
                  <span className="font-bold">✕</span> Left: {leftAssessment.pta} dB PTA
                </span>
                <span className="text-rose-400 flex items-center gap-1.5">
                  <span className="font-bold">◯</span> Right: {rightAssessment.pta} dB PTA
                </span>
              </div>
            </div>

            {/* SVG Plot */}
            <div className="w-full overflow-x-auto bg-slate-950/80 rounded-lg p-2 border border-slate-800/80 flex justify-center">
              <svg width={svgWidth} height={svgHeight} className="text-slate-400 text-xs font-mono select-none">
                {/* 1. Shaded Severity Zones */}
                {/* Normal (0 - 20) */}
                <rect
                  x={padding.left}
                  y={getY(0)}
                  width={graphWidth}
                  height={getY(20) - getY(0)}
                  fill="rgba(16, 185, 129, 0.06)"
                />
                <text x={svgWidth - padding.right - 6} y={getY(12)} textAnchor="end" fill="rgba(16, 185, 129, 0.6)" fontSize="10">
                  Normal (0-20dB)
                </text>

                {/* Mild (20 - 40) */}
                <rect
                  x={padding.left}
                  y={getY(20)}
                  width={graphWidth}
                  height={getY(40) - getY(20)}
                  fill="rgba(245, 158, 11, 0.05)"
                />
                <text x={svgWidth - padding.right - 6} y={getY(32)} textAnchor="end" fill="rgba(245, 158, 11, 0.6)" fontSize="10">
                  Mild (20-40dB)
                </text>

                {/* Moderate (40 - 65) */}
                <rect
                  x={padding.left}
                  y={getY(40)}
                  width={graphWidth}
                  height={getY(65) - getY(40)}
                  fill="rgba(239, 68, 68, 0.05)"
                />
                <text x={svgWidth - padding.right - 6} y={getY(52)} textAnchor="end" fill="rgba(239, 68, 68, 0.6)" fontSize="10">
                  Moderate (40-65dB)
                </text>

                {/* Severe / Profound (> 65) */}
                <rect
                  x={padding.left}
                  y={getY(65)}
                  width={graphWidth}
                  height={getY(100) - getY(65)}
                  fill="rgba(168, 85, 247, 0.05)"
                />
                <text x={svgWidth - padding.right - 6} y={getY(82)} textAnchor="end" fill="rgba(168, 85, 247, 0.6)" fontSize="10">
                  Severe / Profound (65dB+)
                </text>

                {/* 2. Grid Lines (Horizontal dB HL) */}
                {[-10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((db) => {
                  const y = getY(db);
                  return (
                    <g key={db}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="#1e293b"
                        strokeWidth={db === 20 ? '1.5' : '1'}
                        strokeDasharray={db === 20 ? '4 2' : undefined}
                      />
                      <text x={padding.left - 8} y={y + 3.5} textAnchor="end" fill="#64748b" fontSize="10">
                        {db}
                      </text>
                    </g>
                  );
                })}

                {/* 3. Grid Lines (Vertical Frequency Hz) */}
                {STANDARD_FREQUENCIES.map((freq, idx) => {
                  const x = getX(idx);
                  return (
                    <g key={freq}>
                      <line
                        x1={x}
                        y1={padding.top}
                        x2={x}
                        y2={svgHeight - padding.bottom}
                        stroke="#1e293b"
                        strokeWidth="1"
                      />
                      <text x={x} y={svgHeight - padding.bottom + 18} textAnchor="middle" fill="#94a3b8" fontSize="10">
                        {freq >= 1000 ? `${freq / 1000}k` : freq}
                      </text>
                    </g>
                  );
                })}

                {/* X Axis Label */}
                <text x={padding.left + graphWidth / 2} y={svgHeight - 8} textAnchor="middle" fill="#64748b" fontSize="11">
                  Frequency (Hz)
                </text>

                {/* Y Axis Label */}
                <text
                  x={-(padding.top + graphHeight / 2)}
                  y={16}
                  transform="rotate(-90)"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="11"
                >
                  Hearing Level (dB HL)
                </text>

                {/* 4. Left Ear Curve (Blue dashed with ✕ markers) */}
                <path
                  d={getPath(audiogram.leftEar)}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                />
                {audiogram.leftEar.map((d, i) => {
                  const cx = getX(i);
                  const cy = getY(d.dBHL);
                  return (
                    <g key={`left-${d.frequency}`}>
                      <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke="#3b82f6" strokeWidth="2.5" />
                      <line x1={cx + 5} y1={cy - 5} x2={cx - 5} y2={cy + 5} stroke="#3b82f6" strokeWidth="2.5" />
                    </g>
                  );
                })}

                {/* 5. Right Ear Curve (Red solid with ◯ markers) */}
                <path
                  d={getPath(audiogram.rightEar)}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                />
                {audiogram.rightEar.map((d, i) => {
                  const cx = getX(i);
                  const cy = getY(d.dBHL);
                  return (
                    <circle
                      key={`right-${d.frequency}`}
                      cx={cx}
                      cy={cy}
                      r="5"
                      fill="#0f172a"
                      stroke="#f43f5e"
                      strokeWidth="2.5"
                    />
                  );
                })}
              </svg>
            </div>

            {/* Assessment Banner */}
            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Audiological Diagnosis ({activeEar.toUpperCase()} EAR):{' '}
                  <span className="text-cyan-400 font-bold">{currentAssessment.category} Loss</span>
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Pure Tone Avg: <strong className="text-white">{currentAssessment.pta} dB HL</strong>
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {currentAssessment.description}
              </p>
            </div>
          </div>

          {/* 3. Prescription Frequency Gain Matrix (Half-Gain Rule) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Audiometric Compensation Profile (Half-Gain Rule / NAL-R)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Mathematical formula: <code className="text-cyan-300 font-mono">Gain(f) = (Loss - 20) × 0.45 + k(f)</code> with safe acoustic peak limiter
                </p>
              </div>

              <button
                onClick={onApplyToDsp}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-500/20"
              >
                <span>Transfer to Live DSP Engine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Gain Table */}
            <div className="grid grid-cols-6 gap-2 text-center text-xs font-mono">
              {currentAssessment.recommendedGainProfile.map((item) => (
                <div key={item.frequency} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-sans">
                    {item.frequency >= 1000 ? `${item.frequency / 1000}k` : item.frequency} Hz
                  </div>
                  <div className={`text-sm font-bold tabular-nums ${item.gainDb > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
                    +{item.gainDb} dB
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>
                Frequencies with &gt;15 dB boost automatically activate the dynamic range limiter to prevent acoustic shock.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
