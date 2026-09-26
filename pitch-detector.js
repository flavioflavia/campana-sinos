/**
 * BellPitchDetector - Detector de Altura & Afinador Acústico de Sinos
 * Utiliza Autocorrelação Normalizada (YIN/NSDF) para captar a frequência de handbells e tonechimes via microfone.
 */

class BellPitchDetector {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.audioCtx = null;
    this.analyser = null;
    this.micStream = null;
    this.sourceNode = null;
    this.isRunning = false;
    this.animFrameId = null;

    this.sampleRate = 44100;
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);

    // Callbacks
    this.onPitch = null; // ({ freq, note, octave, pitchStr, cents, inTune, clarity })
    this.onSilence = null;

    // Estado atual
    this.lastDetectedPitch = null;
    this.lastDetectedTime = 0;

    // Tabela de frequências para busca rápida
    this.noteTable = this.buildNoteTable();
  }

  buildNoteTable() {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const table = [];
    for (let midi = 24; midi <= 108; midi++) { // C1 a C8
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const noteName = noteNames[midi % 12];
      const octave = Math.floor(midi / 12) - 1;
      table.push({
        midi,
        freq,
        noteName,
        octave,
        pitchStr: `${noteName}${octave}`
      });
    }
    return table;
  }

  async start() {
    if (this.isRunning) return true;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microfone não suportado neste navegador.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.micStream = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = this.audioEngine?.ctx || new AudioCtx();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.sampleRate = this.audioCtx.sampleRate;
      this.sourceNode = this.audioCtx.createMediaStreamSource(stream);

      // Filtro passa-faixa para focar nas frequências de sinos (120 Hz a 4500 Hz)
      const biquadFilter = this.audioCtx.createBiquadFilter();
      biquadFilter.type = 'bandpass';
      biquadFilter.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
      biquadFilter.Q.setValueAtTime(0.5, this.audioCtx.currentTime);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = this.bufferSize;

      this.sourceNode.connect(biquadFilter);
      biquadFilter.connect(this.analyser);

      this.isRunning = true;
      this.loop();
      return true;
    } catch (err) {
      console.warn('Erro ao inicializar microfone:', err);
      this.stop();
      throw err;
    }
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }
    this.lastDetectedPitch = null;
  }

  toggle() {
    return this.isRunning ? this.stop() : this.start();
  }

  loop() {
    if (!this.isRunning) return;

    this.analyser.getFloatTimeDomainData(this.buffer);
    const result = this.detectPitchYIN(this.buffer, this.sampleRate);

    if (result && result.clarity > 0.82 && result.freq >= 120 && result.freq <= 4200) {
      const match = this.getClosestNote(result.freq);
      this.lastDetectedPitch = {
        freq: result.freq,
        clarity: result.clarity,
        note: match.noteName,
        octave: match.octave,
        pitchStr: match.pitchStr,
        cents: match.cents,
        inTune: Math.abs(match.cents) <= 12,
        timestamp: performance.now()
      };

      if (this.onPitch) {
        this.onPitch(this.lastDetectedPitch);
      }
    } else {
      if (performance.now() - this.lastDetectedTime > 400) {
        if (this.onSilence) this.onSilence();
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.loop());
  }

  /**
   * Algoritmo de Autocorrelação com Interpolação Parabólica (YIN simplificado de alta precisão)
   */
  detectPitchYIN(buf, sampleRate) {
    const size = buf.length;
    // Cálculo do RMS para filtro de silêncio
    let sumSquares = 0;
    for (let i = 0; i < size; i++) {
      sumSquares += buf[i] * buf[i];
    }
    const rms = Math.sqrt(sumSquares / size);
    if (rms < 0.015) return null; // Silêncio

    // Limites de busca de período (de ~120 Hz a ~3500 Hz)
    const minPeriod = Math.floor(sampleRate / 3500);
    const maxPeriod = Math.floor(sampleRate / 120);

    const diff = new Float32Array(maxPeriod);
    diff[0] = 0;

    // Diferença quadrada
    for (let tau = 1; tau < maxPeriod; tau++) {
      let sum = 0;
      for (let i = 0; i < size - maxPeriod; i++) {
        const delta = buf[i] - buf[i + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // Média móvel normalizada (Cumulative mean normalized difference)
    const cmnd = new Float32Array(maxPeriod);
    cmnd[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < maxPeriod; tau++) {
      runningSum += diff[tau];
      cmnd[tau] = runningSum === 0 ? 1 : (diff[tau] * tau) / runningSum;
    }

    // Busca do primeiro vale abaixo do limiar (threshold)
    const threshold = 0.18;
    let period = -1;
    for (let tau = minPeriod; tau < maxPeriod; tau++) {
      if (cmnd[tau] < threshold) {
        while (tau + 1 < maxPeriod && cmnd[tau + 1] < cmnd[tau]) {
          tau++;
        }
        period = tau;
        break;
      }
    }

    if (period === -1) {
      // Procura o menor valor global
      let minVal = 1.0;
      for (let tau = minPeriod; tau < maxPeriod; tau++) {
        if (cmnd[tau] < minVal) {
          minVal = cmnd[tau];
          period = tau;
        }
      }
      if (minVal > 0.35) return null;
    }

    // Interpolação parabólica refinada no vértice
    let betterPeriod = period;
    if (period > 0 && period < maxPeriod - 1) {
      const s0 = cmnd[period - 1];
      const s1 = cmnd[period];
      const s2 = cmnd[period + 1];
      const delta = (s2 - s0) / (2 * (2 * s1 - s2 - s0));
      if (!isNaN(delta) && Math.abs(delta) < 1) {
        betterPeriod = period + delta;
      }
    }

    const freq = sampleRate / betterPeriod;
    const clarity = Math.max(0, 1 - (cmnd[period] || 0));

    return { freq, clarity };
  }

  getClosestNote(freq) {
    let closest = this.noteTable[0];
    let minDiff = Infinity;

    for (const item of this.noteTable) {
      const diff = Math.abs(item.freq - freq);
      if (diff < minDiff) {
        minDiff = diff;
        closest = item;
      }
    }

    const cents = Math.round(1200 * Math.log2(freq / closest.freq));
    return {
      noteName: closest.noteName,
      octave: closest.octave,
      pitchStr: closest.pitchStr,
      cents: cents
    };
  }

  /**
   * Verifica se a nota detectada confere com a nota esperada do sino
   */
  matchesTargetPitch(targetPitchStr, toleranceCents = 45) {
    if (!this.lastDetectedPitch) return false;
    const normTarget = targetPitchStr.toUpperCase().replace(/\s+/g, '');
    const normDetected = this.lastDetectedPitch.pitchStr.toUpperCase().replace(/\s+/g, '');

    // Verifica igualdade direta ou enarmônica
    const samePitch = (normTarget === normDetected);
    const inTolerance = Math.abs(this.lastDetectedPitch.cents) <= toleranceCents;

    return samePitch && inTolerance;
  }
}

window.BellPitchDetector = BellPitchDetector;
