/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header } from './components/Header';
import { RecommendationMatrix } from './components/RecommendationMatrix';
import { HearingTestStudio } from './components/HearingTestStudio';
import { LiveDspEngine } from './components/LiveDspEngine';
import { AndroidCodeExport } from './components/AndroidCodeExport';
import { AudiogramData, EarSelection } from './types/audio';
import { INITIAL_AUDIOGRAM } from './utils/audiologyFormula';
import { Cpu, Activity, Sliders, Code2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'recommendation' | 'hearing_test' | 'dsp_lab' | 'android_code'>('recommendation');
  const [audiogram, setAudiogram] = useState<AudiogramData>(INITIAL_AUDIOGRAM);
  const [activeEar, setActiveEar] = useState<EarSelection>('right');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. Universal Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenTest={() => setActiveTab('hearing_test')}
      />

      {/* 2. Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subtle Workspace Breadcrumb Trail */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
          <span>Android Real-Time Audio DSP</span>
          <span aria-hidden="true">·</span>
          <span>Bluetooth Hearing Aid Architecture</span>
          <span aria-hidden="true">·</span>
          <span className="text-cyan-400 font-medium">
            {activeTab === 'recommendation' && 'Architecture & Verdict'}
            {activeTab === 'hearing_test' && 'Pure Tone Audiometry'}
            {activeTab === 'dsp_lab' && 'Live Audio DSP Simulator'}
            {activeTab === 'android_code' && 'Native Android & C++ Oboe Code'}
          </span>
        </div>

        {/* Tab Viewport Content */}
        {activeTab === 'recommendation' && (
          <RecommendationMatrix
            onNavigateToDsp={() => setActiveTab('dsp_lab')}
            onNavigateToHearingTest={() => setActiveTab('hearing_test')}
          />
        )}

        {activeTab === 'hearing_test' && (
          <HearingTestStudio
            audiogram={audiogram}
            setAudiogram={setAudiogram}
            onApplyToDsp={() => setActiveTab('dsp_lab')}
          />
        )}

        {activeTab === 'dsp_lab' && (
          <LiveDspEngine
            audiogram={audiogram}
            activeEar={activeEar}
            setActiveEar={setActiveEar}
          />
        )}

        {activeTab === 'android_code' && (
          <AndroidCodeExport audiogram={audiogram} />
        )}
      </main>

      {/* 3. Quiet Editorial Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">AcoustiTune DSP Architecture</span>
            <span aria-hidden="true">·</span>
            <span>Real-Time AAudio & Oboe Engine</span>
            <span aria-hidden="true">·</span>
            <span>Bluetooth ASHA / LE Audio</span>
          </div>
          <div className="text-slate-500">
            Compliant with ISO 8253-1 Pure-Tone Audiometry & NAL-R Fitting Formulas
          </div>
        </div>
      </footer>
    </div>
  );
}
