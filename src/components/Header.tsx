import React from 'react';
import { Activity, Cpu, Sliders, Code2, Headphones } from 'lucide-react';

interface HeaderProps {
  activeTab: 'recommendation' | 'hearing_test' | 'dsp_lab' | 'android_code';
  setActiveTab: (tab: 'recommendation' | 'hearing_test' | 'dsp_lab' | 'android_code') => void;
  onOpenTest: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenTest }) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Headphones className="w-4 h-4" />
          </div>
          <a
            href="/"
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-cyan-400 transition-colors"
          >
            AcoustiTune DSP
          </a>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('recommendation')}
            className={`flex items-center gap-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'recommendation' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Architecture & Verdict</span>
          </button>

          <button
            onClick={() => setActiveTab('hearing_test')}
            className={`flex items-center gap-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'hearing_test' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Hearing Test (Audiogram)</span>
          </button>

          <button
            onClick={() => setActiveTab('dsp_lab')}
            className={`flex items-center gap-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'dsp_lab' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Live Audio DSP Lab</span>
          </button>

          <button
            onClick={() => setActiveTab('android_code')}
            className={`flex items-center gap-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'android_code' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Native Android Code</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenTest}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-cyan-500/20 cursor-pointer"
          >
            Run Hearing Test
          </button>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 px-2 py-2 bg-slate-900/60 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('recommendation')}
          className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'recommendation' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Verdict
        </button>
        <button
          onClick={() => setActiveTab('hearing_test')}
          className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'hearing_test' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Hearing Test
        </button>
        <button
          onClick={() => setActiveTab('dsp_lab')}
          className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'dsp_lab' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Live DSP Lab
        </button>
        <button
          onClick={() => setActiveTab('android_code')}
          className={`px-2 py-1 whitespace-nowrap shrink-0 ${activeTab === 'android_code' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Android Code
        </button>
      </div>
    </header>
  );
};
