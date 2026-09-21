/**
 * BellAudioEngine - Web Audio API Handbell Synthesizer
 * Síntese acústica cristalina de sinos de bronze ingleses (English Handbells),
 * tubos de mão (Tonechimes) e metrônomo profissional estável.
 */

class BellAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.soundType = 'handbell'; // 'handbell' | 'tonechime' | 'glockenspiel'
    this.volume = 0.85;
    this.activeVoices = new Set();
    this.noteFrequencyMap = this.buildNoteFrequencyMap();
  }

  // Inicializa o AudioContext com gesto do usuário
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      // Limiter transparente de pico para proteger sem bombear dinâmica nas notas simultâneas
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-2.0, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(8.0, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.001, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setSoundType(type) {
    this.soundType = type;
  }

  buildNoteFrequencyMap() {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const enharmonics = {
      'DB': 'C#', 'EB': 'D#', 'FB': 'E', 'GB': 'F#', 'AB': 'G#', 'BB': 'A#',
      'B#': 'C', 'E#': 'F',
      'CB': 'B'
    };

    const map = {};
    for (let octave = 0; octave <= 8; octave++) {
      for (let i = 0; i < 12; i++) {
        const noteName = notes[i];
        const midi = (octave + 1) * 12 + i;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        map[`${noteName}${octave}`] = freq;
      }
    }

    // Adiciona enarmônicos (bemóis)
    for (let octave = 0; octave <= 8; octave++) {
      for (const [flat, sharp] of Object.entries(enharmonics)) {
        if (map[`${sharp}${octave}`]) {
          map[`${flat}${octave}`] = map[`${sharp}${octave}`];
        }
      }
    }

    return map;
  }

  getFrequency(pitchStr) {
    if (!pitchStr) return null;
    const clean = pitchStr.toUpperCase().replace(/\s+/g, '');
    return this.noteFrequencyMap[clean] || null;
  }

  /**
   * Toca o sino no tempo especificado (ou agora)
   * @param {string} pitch - Ex: "C5", "D#4", "G3"
   * @param {number|null} when - Tempo de áudio do AudioContext (se null, toca imediatamente)
   * @param {number} duration - Duração estimada em segundos
   * @param {number} velocity - Dinâmica (0.1 a 1.0)
   * @param {boolean} isSoloHighlight - Se é o sino atribuído ao usuário
   * @param {number|null} exactFreq - Frequência direta em Hz (opcional)
   */
  playBell(pitch, when = null, duration = 2.5, velocity = 0.8, isSoloHighlight = false, exactFreq = null) {
    this.init();
    const freq = exactFreq && exactFreq > 20 ? exactFreq : this.getFrequency(pitch);
    if (!freq || isNaN(freq)) return null;

    const startTime = when !== null ? Math.max(when, this.ctx.currentTime) : this.ctx.currentTime;

    let voice = null;
    switch (this.soundType) {
      case 'tonechime':
        voice = this.synthTonechime(freq, startTime, duration, velocity, isSoloHighlight);
        break;
      case 'glockenspiel':
        voice = this.synthGlockenspiel(freq, startTime, duration, velocity, isSoloHighlight);
        break;
      case 'handbell':
      default:
        voice = this.synthHandbell(freq, startTime, duration, velocity, isSoloHighlight);
        break;
    }

    if (voice) {
      this.activeVoices.add(voice);
      setTimeout(() => {
        this.activeVoices.delete(voice);
      }, Math.max(1000, (duration + 1) * 1000));
    }

    return voice;
  }

  /**
   * Síntese Acústica Cristalina de Handbell de Bronze (English Handbell)
   * Timbre quente, rico e ressonante de bronze polido.
   */
  synthHandbell(f0, t0, duration, vel, isHighlight) {
    const ctx = this.ctx;
    const effectiveVel = Math.min(1.0, vel * (isHighlight ? 1.15 : 1.0));

    // Sinos graves de bronze (Oitava 3) ressoam por até 5-6s; agudos ressoam 2.5-3.5s
    const decayTime = f0 < 180 ? 5.8 : (f0 < 350 ? 4.5 : (f0 < 700 ? 3.4 : 2.6));
    const bellDecay = Math.max(duration * 1.3, decayTime);

    // 1. FUNDAMENTAL (f0) - O corpo ressonante do sino
    const oscFund = ctx.createOscillator();
    const gainFund = ctx.createGain();
    oscFund.type = 'sine';
    oscFund.frequency.setValueAtTime(f0, t0);

    const fundVol = f0 < 250 ? 0.60 * effectiveVel : 0.52 * effectiveVel;
    const attackTime = 0.005; // 5ms ataque macio de batedor de feltro

    gainFund.gain.setValueAtTime(0.00001, t0);
    gainFund.gain.linearRampToValueAtTime(fundVol, t0 + attackTime);
    gainFund.gain.exponentialRampToValueAtTime(0.00001, t0 + bellDecay);

    oscFund.connect(gainFund);
    gainFund.connect(this.masterGain);

    // 2. SEGUNDO HARMÔNICO AFINADO (A clássica 12ª de sino inglês: 3.0 * f0)
    // Nos sinos ingleses afinados (Malmark / Schulmerich), este harmônico produz o brilho celestial
    const oscHarm1 = ctx.createOscillator();
    const gainHarm1 = ctx.createGain();
    oscHarm1.type = 'sine';
    // Pequeníssimo desvio (detune natural do bronze ~0.15%) para calor acústico
    oscHarm1.frequency.setValueAtTime(f0 * 3.002, t0);

    const harm1Vol = (f0 < 250 ? 0.22 : 0.32) * effectiveVel;
    const harm1Decay = bellDecay * 0.65;

    gainHarm1.gain.setValueAtTime(0.00001, t0);
    gainHarm1.gain.linearRampToValueAtTime(harm1Vol, t0 + attackTime * 0.9);
    gainHarm1.gain.exponentialRampToValueAtTime(0.00001, t0 + harm1Decay);

    oscHarm1.connect(gainHarm1);
    gainHarm1.connect(this.masterGain);

    // 3. HARMÔNICO DE OITAVA (2.0 * f0) - Muito presente em sinos médios e graves
    const oscHarm2 = ctx.createOscillator();
    const gainHarm2 = ctx.createGain();
    oscHarm2.type = 'sine';
    oscHarm2.frequency.setValueAtTime(f0 * 2.0, t0);

    const harm2Vol = (f0 < 250 ? 0.25 : 0.16) * effectiveVel;
    const harm2Decay = bellDecay * 0.5;

    gainHarm2.gain.setValueAtTime(0.00001, t0);
    gainHarm2.gain.linearRampToValueAtTime(harm2Vol, t0 + attackTime * 1.1);
    gainHarm2.gain.exponentialRampToValueAtTime(0.00001, t0 + harm2Decay);

    oscHarm2.connect(gainHarm2);
    gainHarm2.connect(this.masterGain);

    // 4. HARMÔNICO SUPERIOR BRILHANTE (5.0 * f0) - Ataque luminoso de bronze
    let oscHarm3 = null;
    let gainHarm3 = null;
    if (f0 < 1000) {
      oscHarm3 = ctx.createOscillator();
      gainHarm3 = ctx.createGain();
      oscHarm3.type = 'sine';
      oscHarm3.frequency.setValueAtTime(f0 * 5.03, t0);

      gainHarm3.gain.setValueAtTime(0.00001, t0);
      gainHarm3.gain.linearRampToValueAtTime(0.08 * effectiveVel, t0 + 0.004);
      gainHarm3.gain.exponentialRampToValueAtTime(0.00001, t0 + 0.45);

      oscHarm3.connect(gainHarm3);
      gainHarm3.connect(this.masterGain);
      oscHarm3.start(t0);
      oscHarm3.stop(t0 + 0.5);
    }

    // Iniciar osciladores
    oscFund.start(t0);
    oscHarm1.start(t0);
    oscHarm2.start(t0);

    const stopTime = t0 + bellDecay;
    oscFund.stop(stopTime);
    oscHarm1.stop(stopTime);
    oscHarm2.stop(stopTime);

    const voice = {
      stop: (dampTime = ctx.currentTime) => {
        try {
          const dt = Math.max(dampTime, ctx.currentTime);
          gainFund.gain.cancelScheduledValues(dt);
          gainFund.gain.setValueAtTime(Math.max(0.00001, gainFund.gain.value), dt);
          gainFund.gain.exponentialRampToValueAtTime(0.00001, dt + 0.06);

          gainHarm1.gain.cancelScheduledValues(dt);
          gainHarm1.gain.setValueAtTime(Math.max(0.00001, gainHarm1.gain.value), dt);
          gainHarm1.gain.exponentialRampToValueAtTime(0.00001, dt + 0.05);

          gainHarm2.gain.cancelScheduledValues(dt);
          gainHarm2.gain.setValueAtTime(Math.max(0.00001, gainHarm2.gain.value), dt);
          gainHarm2.gain.exponentialRampToValueAtTime(0.00001, dt + 0.05);
        } catch (e) {}
      }
    };

    return voice;
  }

  /**
   * Síntese de Tonechime (Sino tubular / Chime de alumínio)
   * Som puro, macio e aveludado
   */
  synthTonechime(f0, t0, duration, vel, isHighlight) {
    const ctx = this.ctx;
    const effectiveVel = Math.min(1.0, vel * (isHighlight ? 1.15 : 1.0));
    const decay = Math.max(duration * 1.5, 3.8);

    const oscFund = ctx.createOscillator();
    const gainFund = ctx.createGain();
    oscFund.type = 'sine';
    oscFund.frequency.setValueAtTime(f0, t0);

    gainFund.gain.setValueAtTime(0.00001, t0);
    gainFund.gain.linearRampToValueAtTime(0.65 * effectiveVel, t0 + 0.015);
    gainFund.gain.exponentialRampToValueAtTime(0.00001, t0 + decay);

    // Segundo harmônico tubular muito sutil (2.756 * f0)
    const oscHarm = ctx.createOscillator();
    const gainHarm = ctx.createGain();
    oscHarm.type = 'sine';
    oscHarm.frequency.setValueAtTime(f0 * 2.756, t0);

    gainHarm.gain.setValueAtTime(0.00001, t0);
    gainHarm.gain.linearRampToValueAtTime(0.12 * effectiveVel, t0 + 0.008);
    gainHarm.gain.exponentialRampToValueAtTime(0.00001, t0 + decay * 0.4);

    oscFund.connect(gainFund);
    gainFund.connect(this.masterGain);
    oscHarm.connect(gainHarm);
    gainHarm.connect(this.masterGain);

    oscFund.start(t0);
    oscHarm.start(t0);

    const stopTime = t0 + decay;
    oscFund.stop(stopTime);
    oscHarm.stop(stopTime);

    return {
      stop: (dampTime = ctx.currentTime) => {
        try {
          const dt = Math.max(dampTime, ctx.currentTime);
          gainFund.gain.cancelScheduledValues(dt);
          gainFund.gain.exponentialRampToValueAtTime(0.00001, dt + 0.08);
        } catch (e) {}
      }
    };
  }

  /**
   * Síntese de Glockenspiel / Celesta
   */
  synthGlockenspiel(f0, t0, duration, vel, isHighlight) {
    const ctx = this.ctx;
    const effectiveVel = Math.min(1.0, vel * (isHighlight ? 1.15 : 1.0));
    const decay = 2.2;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t0);

    gain.gain.setValueAtTime(0.00001, t0);
    gain.gain.linearRampToValueAtTime(0.7 * effectiveVel, t0 + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.00001, t0 + decay);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t0);
    osc.stop(t0 + decay);

    return {
      stop: (dampTime = ctx.currentTime) => {
        try {
          gain.gain.cancelScheduledValues(dampTime);
          gain.gain.exponentialRampToValueAtTime(0.00001, dampTime + 0.04);
        } catch (e) {}
      }
    };
  }

  /**
   * Clique amadeirado nítido para o metrônomo
   */
  playMetronomeClick(isAccent = false, when = null) {
    this.init();
    const t0 = when !== null ? Math.max(when, this.ctx.currentTime) : this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1800 : 1200, t0);
    osc.frequency.exponentialRampToValueAtTime(200, t0 + 0.025);

    gain.gain.setValueAtTime(isAccent ? 0.4 : 0.25, t0);
    gain.gain.exponentialRampToValueAtTime(0.00001, t0 + 0.035);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t0);
    osc.stop(t0 + 0.04);
  }

  playCountInTick(beatNumber, totalBeats, when = null) {
    this.playMetronomeClick(beatNumber === 1, when);
  }

  dampAll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      if (voice && typeof voice.stop === 'function') {
        voice.stop(now);
      }
    }
    this.activeVoices.clear();
  }
}

// Exporta globalmente
window.BellAudioEngine = BellAudioEngine;
