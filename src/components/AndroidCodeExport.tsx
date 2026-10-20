import React, { useState } from 'react';
import { AudiogramData } from '../types/audio';
import { calculatePrescriptionGains } from '../utils/audiologyFormula';
import { Copy, Check, Download, FileCode, Cpu, Layers } from 'lucide-react';

interface AndroidCodeExportProps {
  audiogram: AudiogramData;
}

export const AndroidCodeExport: React.FC<AndroidCodeExportProps> = ({ audiogram }) => {
  const [activeFile, setActiveFile] = useState<
    'AudioEngine_cpp' | 'AudioEngine_h' | 'AudioService_kt' | 'AudiogramFitter_kt' | 'AndroidManifest_xml' | 'build_gradle'
  >('AudioEngine_cpp');
  const [copied, setCopied] = useState<boolean>(false);

  const leftGains = calculatePrescriptionGains(audiogram.leftEar);
  const rightGains = calculatePrescriptionGains(audiogram.rightEar);

  const codeFiles = {
    AudioEngine_cpp: `/**
 * AudioEngine.cpp
 * Low-latency real-time audio pipeline using Google Oboe (AAudio/OpenSL ES)
 * Runs DSP noise cancellation and 6-band audiometric biquad filter bank.
 */

#include "AudioEngine.h"
#include <android/log.h>
#include <cmath>

#define TAG "AcoustiTune_DSP"

AudioEngine::AudioEngine() {
    initFilters();
}

AudioEngine::~AudioEngine() {
    stop();
}

bool AudioEngine::start() {
    // 1. Build Recording Stream (Microphone Input)
    oboe::AudioStreamBuilder inBuilder;
    inBuilder.setDirection(oboe::Direction::Input)
        ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
        ->setSharingMode(oboe::SharingMode::Exclusive)
        ->setFormat(oboe::AudioFormat::Float)
        ->setChannelCount(oboe::ChannelCount::Mono)
        ->setSampleRate(kSampleRate)
        ->setInputPreset(oboe::InputPreset::Unprocessed); // Bypass Android OS AGC & AEC

    oboe::Result r = inBuilder.openStream(mInputStream);
    if (r != oboe::Result::OK) {
        __android_log_print(ANDROID_LOG_ERROR, TAG, "Failed to open input stream");
        return false;
    }

    // 2. Build Playback Stream (Bluetooth ASHA / LE Audio Headset)
    oboe::AudioStreamBuilder outBuilder;
    outBuilder.setDirection(oboe::Direction::Output)
        ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
        ->setSharingMode(oboe::SharingMode::Exclusive)
        ->setFormat(oboe::AudioFormat::Float)
        ->setChannelCount(oboe::ChannelCount::Stereo)
        ->setSampleRate(kSampleRate)
        ->setDataCallback(this);

    r = outBuilder.openStream(mOutputStream);
    if (r != oboe::Result::OK) {
        __android_log_print(ANDROID_LOG_ERROR, TAG, "Failed to open output stream");
        mInputStream->close();
        return false;
    }

    mInputStream->requestStart();
    mOutputStream->requestStart();
    mIsRunning = true;
    return true;
}

void AudioEngine::stop() {
    mIsRunning = false;
    if (mInputStream) {
        mInputStream->stop();
        mInputStream->close();
    }
    if (mOutputStream) {
        mOutputStream->stop();
        mOutputStream->close();
    }
}

/**
 * Real-time audio callback executed on high-priority audio thread.
 * ZERO memory allocation or JNI calls allowed here!
 */
oboe::DataCallbackResult AudioEngine::onAudioReady(
    oboe::AudioStream *oboeStream,
    void *audioData,
    int32_t numFrames) {

    float *output = static_cast<float *>(audioData);

    // Read microphone frames
    int32_t framesRead = mInputStream->read(mInputBuffer, numFrames, 0);
    if (framesRead <= 0) {
        std::fill_n(output, numFrames * 2, 0.0f);
        return oboe::DataCallbackResult::Continue;
    }

    // Process each sample frame
    for (int i = 0; i < framesRead; i++) {
        float sample = mInputBuffer[i];

        // 1. High-Pass Filter (cut rumble < 120Hz)
        sample = mHighPassFilter.process(sample);

        // 2. Noise Gate / Downward Expander
        float sampleMag = std::abs(sample);
        mRmsTracker = 0.95f * mRmsTracker + 0.05f * sampleMag;
        if (mRmsTracker < mNoiseGateThreshold) {
            sample *= 0.15f; // Attenuate noise floor
        }

        // 3. 6-Band Audiometric Biquad Equalizer Filter Bank
        float leftSample = sample;
        float rightSample = sample;

        for (int b = 0; b < 6; b++) {
            leftSample = mLeftFilters[b].process(leftSample);
            rightSample = mRightFilters[b].process(rightSample);
        }

        // 4. Soft-Knee Safety Peak Limiter (hearing protection)
        leftSample = std::tanh(leftSample * 0.9f);
        rightSample = std::tanh(rightSample * 0.9f);

        // Interleaved Stereo Output (L, R)
        output[i * 2] = leftSample;
        output[i * 2 + 1] = rightSample;
    }

    return oboe::DataCallbackResult::Continue;
}

void AudioEngine::updateBandGain(int ear, int bandIndex, float gainDb) {
    if (bandIndex < 0 || bandIndex >= 6) return;
    float freqs[6] = {250.0f, 500.0f, 1000.0f, 2000.0f, 4000.0f, 8000.0f};

    if (ear == 0 || ear == 2) {
        mLeftFilters[bandIndex].configurePeaking(freqs[bandIndex], gainDb, 1.4f, kSampleRate);
    }
    if (ear == 1 || ear == 2) {
        mRightFilters[bandIndex].configurePeaking(freqs[bandIndex], gainDb, 1.4f, kSampleRate);
    }
}
`,
    AudioEngine_h: `/**
 * AudioEngine.h
 * C++ NDK interface for low-latency audio capture, biquad EQ, and limiter.
 */

#pragma once
#include <oboe/Oboe.h>
#include <vector>

struct BiquadFilter {
    float b0 = 1.0f, b1 = 0.0f, b2 = 0.0f;
    float a1 = 0.0f, a2 = 0.0f;
    float z1 = 0.0f, z2 = 0.0f;

    inline float process(float in) {
        float out = in * b0 + z1;
        z1 = in * b1 + z2 - a1 * out;
        z2 = in * b2 - a2 * out;
        return out;
    }

    void configurePeaking(float f0, float gainDb, float Q, float Fs) {
        float A = std::pow(10.0f, gainDb / 40.0f);
        float omega = 2.0f * M_PI * f0 / Fs;
        float alpha = std::sin(omega) / (2.0f * Q);
        float cosOmega = std::cos(omega);

        float a0 = 1.0f + alpha / A;
        b0 = (1.0f + alpha * A) / a0;
        b1 = (-2.0f * cosOmega) / a0;
        b2 = (1.0f - alpha * A) / a0;
        a1 = (-2.0f * cosOmega) / a0;
        a2 = (1.0f - alpha / A) / a0;
    }
};

class AudioEngine : public oboe::AudioStreamDataCallback {
public:
    AudioEngine();
    virtual ~AudioEngine();

    bool start();
    void stop();
    void updateBandGain(int ear, int bandIndex, float gainDb);

    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream *oboeStream,
        void *audioData,
        int32_t numFrames) override;

private:
    void initFilters();

    static constexpr int32_t kSampleRate = 48000;
    std::shared_ptr<oboe::AudioStream> mInputStream;
    std::shared_ptr<oboe::AudioStream> mOutputStream;

    float mInputBuffer[1024];
    BiquadFilter mHighPassFilter;
    BiquadFilter mLeftFilters[6];
    BiquadFilter mRightFilters[6];

    float mRmsTracker = 0.0f;
    float mNoiseGateThreshold = 0.008f;
    bool mIsRunning = false;
};
`,
    AudioService_kt: `/**
 * AudioService.kt
 * Android Foreground Service managing real-time microphone capture,
 * low-latency Bluetooth routing (ASHA / BLE Audio LC3), and C++ NDK engine.
 */

package com.acoustitune.dsp.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class AudioService : Service() {

    private lateinit var audioManager: AudioManager
    private var nativeEngineHandle: Long = 0

    companion object {
        init {
            System.loadLibrary("acoustitune_dsp")
        }
        const val CHANNEL_ID = "AcoustiTune_Streaming_Channel"
        const val NOTIFICATION_ID = 1001
    }

    // Native C++ NDK Bridge Functions
    private external fun nativeCreateEngine(): Long
    private external fun nativeStartEngine(handle: Long): Boolean
    private external fun nativeStopEngine(handle: Long)
    private external fun nativeUpdateGain(handle: Long, ear: Int, band: Int, gainDb: Float)

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        createNotificationChannel()
        nativeEngineHandle = nativeCreateEngine()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildForegroundNotification()

        // Required Android 14+ foreground service type for mic streaming
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // Route low-latency audio to Bluetooth Headset / Hearing Aid
        configureBluetoothRouting()

        // Start C++ Oboe Audio Streams
        nativeStartEngine(nativeEngineHandle)

        return START_STICKY
    }

    /**
     * Prioritizes Bluetooth ASHA (Hearing Aids) and BLE Audio (LC3)
     * over high-latency standard A2DP.
     */
    private fun configureBluetoothRouting() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val devices = audioManager.availableCommunicationDevices
            val preferredDevice = devices.firstOrNull { device ->
                device.type == AudioDeviceInfo.TYPE_BLE_HEADSET ||
                device.type == AudioDeviceInfo.TYPE_HEARING_AID
            } ?: devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }

            if (preferredDevice != null) {
                audioManager.setCommunicationDevice(preferredDevice)
            }
        } else {
            // Legacy Bluetooth SCO fallback
            @Suppress("DEPRECATION")
            audioManager.startBluetoothSco()
            @Suppress("DEPRECATION")
            audioManager.isBluetoothScoOn = true
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        nativeStopEngine(nativeEngineHandle)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            audioManager.clearCommunicationDevice()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Live Hearing & Noise Cancellation Stream",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("AcoustiTune DSP Active")
            .setContentText("Streaming microphone audio with noise reduction to BT headset")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
    }
}
`,
    AudiogramFitter_kt: `/**
 * AudiogramFitter.kt
 * Computes Half-Gain Rule (NAL-R) target gains and biquad filter parameters
 * from user's pure tone audiometry results.
 */

package com.acoustitune.dsp.audiology

data class FrequencyThreshold(val frequency: Int, val dBHL: Int)

class AudiogramFitter {

    /**
     * Converts pure tone audiogram hearing loss into target EQ gain (dB)
     * Half-Gain Formula: Gain = (Loss - 20) * 0.45 + frequency_weight
     */
    fun calculateTargetGains(thresholds: List<FrequencyThreshold>): FloatArray {
        return thresholds.map { item ->
            if (item.dBHL <= 20) {
                0.0f
            } else {
                var gain = (item.dBHL - 20) * 0.45f

                // Presbycusis speech intelligibility weight
                if (item.frequency == 2000 || item.frequency == 4000) {
                    gain += 2.0f
                } else if (item.frequency == 250) {
                    gain *= 0.6f // Reduce bass boost to prevent masking
                }

                // Safety maximum gain limit: +24 dB
                gain.coerceIn(0.0f, 24.0f)
            }
        }.toFloatArray()
    }
}
`,
    AndroidManifest_xml: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.acoustitune.dsp">

    <!-- Low-latency microphone streaming permissions -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    
    <!-- Bluetooth routing permissions -->
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    
    <!-- Android 14+ Foreground Service Microphone permission -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="AcoustiTune DSP"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.Material3.Dark">

        <activity
            android:name=".ui.MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Persistent real-time audio streaming background service -->
        <service
            android:name=".service.AudioService"
            android:foregroundServiceType="microphone"
            android:exported="false" />

    </application>
</manifest>
`,
    build_gradle: `// app/build.gradle.kts
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.acoustitune.dsp"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.acoustitune.dsp"
        minSdk = 26 // Android 8.0+ for AAudio
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        externalNativeBuild {
            cmake {
                cppFlags += "-std=c++17 -O3 -mfloat-abi=softfp -mfpu=neon"
                arguments += "-DANDROID_STL=c++_shared"
            }
        }
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }
}

dependencies {
    // Official Google Oboe C++ Audio Library for low-latency AAudio
    implementation("com.google.oboe:oboe:1.9.0")
    
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.activity:activity-compose:1.10.1")
}
`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeFiles[activeFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPreset = () => {
    const payload = {
      appName: 'AcoustiTune DSP',
      timestamp: new Date().toISOString(),
      leftEarAudiogram: audiogram.leftEar,
      rightEarAudiogram: audiogram.rightEar,
      leftCalculatedGainsDb: leftGains,
      rightCalculatedGainsDb: rightGains,
      suggestedBiquadQ: 1.4,
      dspRecommendedConfig: {
        highPassCutoffHz: 130,
        noiseGateThresholdDb: -42,
        peakLimiterCeilingDb: -1.0,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'acoustitune_hearing_dsp_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 py-2">
      {/* 1. Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Ready-to-Deploy Codebase
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Native Android Source Code Architecture
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete production-ready C++ Oboe real-time audio pipeline, Bluetooth ASHA/LE Audio device routing, and audiogram coefficient math.
          </p>
        </div>

        <button
          onClick={handleDownloadPreset}
          className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-2 self-start sm:self-auto cursor-pointer shadow-sm shadow-cyan-500/20"
        >
          <Download className="w-4 h-4" />
          <span>Export DSP & Audiogram JSON</span>
        </button>
      </div>

      {/* 2. File Tabs & Code Editor Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Tab Strip */}
        <div className="flex items-center justify-between bg-slate-900/90 border-b border-slate-800 px-4 py-2 overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {[
              { id: 'AudioEngine_cpp', label: 'AudioEngine.cpp', icon: Cpu },
              { id: 'AudioEngine_h', label: 'AudioEngine.h', icon: FileCode },
              { id: 'AudioService_kt', label: 'AudioService.kt', icon: Layers },
              { id: 'AudiogramFitter_kt', label: 'AudiogramFitter.kt', icon: FileCode },
              { id: 'AndroidManifest_xml', label: 'AndroidManifest.xml', icon: FileCode },
              { id: 'build_gradle', label: 'build.gradle.kts', icon: FileCode },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFile(tab.id as typeof activeFile)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeFile === tab.id
                      ? 'bg-slate-800 text-cyan-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Code Content Viewport */}
        <div className="p-5 overflow-x-auto max-h-[580px]">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed select-text">
            <code>{codeFiles[activeFile]}</code>
          </pre>
        </div>
      </div>

      {/* 3. Integration Guide Footnote */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/40 p-6 rounded-xl border border-slate-800 text-xs">
        <div className="space-y-1.5">
          <div className="font-semibold text-white">1. Add Google Oboe Dependency</div>
          <p className="text-slate-400 leading-relaxed">
            Oboe is Google's official C++ wrapper around AAudio and OpenSL ES that automatically selects the lowest-latency audio path on every Android model.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="font-semibold text-white">2. Exclusive Audio Streams</div>
          <p className="text-slate-400 leading-relaxed">
            By configuring <code className="text-cyan-300 font-mono">SharingMode::Exclusive</code> and <code className="text-cyan-300 font-mono">PerformanceMode::LowLatency</code>, Oboe bypasses the Android audio mixer for direct ALSA hardware access.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="font-semibold text-white">3. Android 13/14+ BLE Audio</div>
          <p className="text-slate-400 leading-relaxed">
            Use <code className="text-cyan-300 font-mono">AudioManager.setCommunicationDevice</code> with <code className="text-cyan-300 font-mono">TYPE_BLE_HEADSET</code> or <code className="text-cyan-300 font-mono">TYPE_HEARING_AID</code> to establish 20–30ms isochronous streams.
          </p>
        </div>
      </div>
    </div>
  );
};
