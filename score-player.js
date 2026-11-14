/**
 * ScorePlayer - OSMD Sincronizador de Partitura & Handbells
 * Gerencia a timeline de execução, o cursor do OSMD, o áudio dos sinos,
 * e a mudança dinâmica de cor das notas quando forem tocadas.
 */

class ScorePlayer {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.osmd = null;
    this.timeline = [];
    this.currentStepIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.isCountingIn = false;

    // Configurações musicais
    this.baseBpm = 100;
    this.tempoMultiplier = 1.0;
    this.effectiveBpm = 100;
    this.timeSignature = { beats: 4, beatType: 4 };

    // Modos de prática
    this.practiceMode = 'all'; // 'all' | 'mute-mine' | 'solo-mine'
    this.metronomeEnabled = true;
    this.countInEnabled = true;
    this.lookaheadNotice = true;

    // Loop de Trecho Difícil (Modo A-B Loop & Treino Acelerador)
    this.loopA = null; // Compasso inicial
    this.loopB = null; // Compasso final
    this.loopEnabled = false;
    this.acceleratorEnabled = false;
    this.acceleratorStep = 0.05; // Acelera +5% a cada ciclo
    this.acceleratorMax = 1.30;  // Limite máximo do acelerador
    this.onAcceleratorTick = null;
    this.onLoopIteration = null;

    // Maestro Sync (Regente e Seguidores)
    this.onSyncBroadcast = null;
    this.isSyncFollower = false;

    // Sinos atribuídos ao usuário: Map de pitch => { color, activeColor, hand, label }
    this.userBells = new Map();

    // Callbacks para UI
    this.onStateChange = null;
    this.onStep = null;
    this.onUserBellHit = null;
    this.onUserBellPrepare = null;
    this.onMeasureChange = null;

    // Timers e relógio de alta precisão
    this.playbackTimer = null;
    this.activeNoteRestores = [];
    this.lastActiveUserNotes = [];
    this.stepCursorNeedsAdvance = false;
    this.playbackStartAudioTime = 0;
    this.playbackStartQuarters = 0;
  }

  setOSMD(osmdInstance) {
    this.osmd = osmdInstance;
  }

  setUserBells(bellsMap) {
    this.userBells = new Map(bellsMap);
    this.refreshStaticHighlights();
  }

  setLoop(startMeasure, endMeasure, enabled = true) {
    this.loopA = startMeasure !== null ? Math.max(1, startMeasure) : null;
    this.loopB = endMeasure !== null ? Math.max(1, endMeasure) : null;
    if (this.loopA !== null && this.loopB !== null && this.loopB < this.loopA) {
      const tmp = this.loopA;
      this.loopA = this.loopB;
      this.loopB = tmp;
    }
    this.loopEnabled = enabled && this.loopA !== null && this.loopB !== null;
  }

  setLoopA(measureNum) {
    this.loopA = measureNum ? Math.max(1, measureNum) : null;
    if (this.loopA !== null && this.loopB !== null && this.loopB < this.loopA) {
      this.loopB = this.loopA;
    }
  }

  setLoopB(measureNum) {
    this.loopB = measureNum ? Math.max(1, measureNum) : null;
    if (this.loopA !== null && this.loopB !== null && this.loopB < this.loopA) {
      this.loopA = this.loopB;
    }
  }

  toggleLoop(enabled = null) {
    if (enabled !== null) {
      this.loopEnabled = enabled;
    } else {
      this.loopEnabled = !this.loopEnabled;
    }
    return this.loopEnabled;
  }

  clearLoop() {
    this.loopA = null;
    this.loopB = null;
    this.loopEnabled = false;
  }

  setAccelerator(enabled, step = 0.05, max = 1.30) {
    this.acceleratorEnabled = !!enabled;
    this.acceleratorStep = step;
    this.acceleratorMax = max;
  }

  setBpmMultiplier(factor, notifySync = true) {
    this.tempoMultiplier = Math.max(0.3, Math.min(2.0, factor));
    this.updateEffectiveBpm();
    if (notifySync && this.onSyncBroadcast && !this.isSyncFollower) {
      this.onSyncBroadcast({
        type: 'tempo',
        tempoMultiplier: this.tempoMultiplier,
        bpm: this.effectiveBpm
      });
    }
  }

  setCustomBpm(bpm) {
    this.baseBpm = Math.max(30, Math.min(240, bpm));
    this.updateEffectiveBpm();
  }

  updateEffectiveBpm() {
    this.effectiveBpm = Math.round(this.baseBpm * this.tempoMultiplier);
  }

  setPracticeMode(mode) {
    this.practiceMode = mode;
  }

  /**
   * Recebe o MusicXML bruto e indexa as técnicas de sinos marcadas nota a nota
   * (<technical><handbell>martellato|pluck|damp|gyro|swing...</handbell></technical>).
   * O OSMD não expõe esse elemento, então a leitura é feita direto do XML.
   * Chave: "índiceDoCompasso|inícioEmSemínimas|midi".
   */
  setSourceXml(xmlText) {
    this.xmlTechniques = ScorePlayer.indexXmlTechniques(xmlText);
  }

  static mapHandbellValue(value) {
    const v = String(value || '').toLowerCase().trim();
    if (!v) return null;
    if (v.includes('martellato') || v.includes('mallet')) return 'martellato';
    if (v.includes('pluck')) return 'pluck';
    if (v.includes('damp')) return 'damp';
    if (v.includes('shake')) return 'shake';
    if (v === 'gyro' || v === 'swing' || v === 'echo' || v === 'belltree' || v === 'lv') return 'lv';
    return null;
  }

  static indexXmlTechniques(xmlText) {
    const map = new Map();
    if (!xmlText || typeof DOMParser === 'undefined') return map;
    let doc;
    try {
      doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) return map;
    } catch (e) {
      return map;
    }
    const steps = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const childText = (el, tag) => {
      const c = el.getElementsByTagName(tag)[0];
      return c ? c.textContent.trim() : null;
    };
    const part = doc.getElementsByTagName('part')[0];
    if (!part) return map;

    // Passo 1: percorre o XML coletando notas (com posição) e marcações de texto LV/SB/R por pauta
    let divisions = 1;
    const notes = [];      // { measureIdx, onsetQ, midi, staff, tech }
    const lvEvents = [];   // { measureIdx, onsetQ, staff (null = todas), on }
    const measures = Array.from(part.children).filter(el => el.tagName === 'measure');
    measures.forEach((measure, measureIdx) => {
      let pos = 0;       // posição atual em divisions
      let lastOnset = 0; // início da nota anterior (para acordes)
      for (const el of Array.from(measure.children)) {
        if (el.tagName === 'attributes') {
          const d = childText(el, 'divisions');
          if (d) divisions = parseFloat(d) || divisions;
        } else if (el.tagName === 'backup') {
          pos -= parseFloat(childText(el, 'duration') || '0');
        } else if (el.tagName === 'forward') {
          pos += parseFloat(childText(el, 'duration') || '0');
        } else if (el.tagName === 'direction') {
          const words = Array.from(el.getElementsByTagName('words')).map(w => w.textContent).join(' ');
          const state = ScorePlayer.parseLvWords(words);
          if (state === null) continue;
          const offset = parseFloat(childText(el, 'offset') || '0');
          const staffTxt = childText(el, 'staff');
          lvEvents.push({
            measureIdx,
            onsetQ: (pos + offset) / divisions,
            staff: staffTxt ? parseInt(staffTxt, 10) : null,
            on: state
          });
        } else if (el.tagName === 'note') {
          const isChord = el.getElementsByTagName('chord').length > 0;
          const isGrace = el.getElementsByTagName('grace').length > 0;
          const dur = parseFloat(childText(el, 'duration') || '0');
          const onset = isChord ? lastOnset : pos;
          if (!isChord && !isGrace) {
            lastOnset = pos;
            pos += dur;
          }
          const pitchEl = el.getElementsByTagName('pitch')[0];
          if (!pitchEl) continue;
          const step = childText(pitchEl, 'step');
          const alter = parseFloat(childText(pitchEl, 'alter') || '0');
          const octave = parseInt(childText(pitchEl, 'octave') || '4', 10);
          if (!(step in steps)) continue;
          const hb = el.getElementsByTagName('handbell')[0];
          const staffTxt = childText(el, 'staff');
          notes.push({
            measureIdx,
            onsetQ: Math.round((onset / divisions) * 1000) / 1000,
            midi: (octave + 1) * 12 + steps[step] + Math.round(alter),
            staff: staffTxt ? parseInt(staffTxt, 10) : 1,
            tech: hb ? ScorePlayer.mapHandbellValue(hb.textContent) : null
          });
        }
      }
    });

    // Passo 2: técnica explícita na nota tem prioridade; senão vale o estado LV/R vigente na pauta
    const before = (a, mIdx, q) => a.measureIdx < mIdx || (a.measureIdx === mIdx && a.onsetQ <= q + 1e-6);
    lvEvents.sort((a, b) => a.measureIdx - b.measureIdx || a.onsetQ - b.onsetQ);
    for (const n of notes) {
      let tech = n.tech;
      if (!tech && lvEvents.length) {
        let on = false;
        for (const ev of lvEvents) {
          if (!before(ev, n.measureIdx, n.onsetQ)) break;
          if (ev.staff === null || ev.staff === n.staff) on = ev.on;
        }
        if (on) tech = 'lv';
      }
      if (tech) map.set(`${n.measureIdx}|${n.onsetQ}|${n.midi}`, tech);
    }
    return map;
  }

  /**
   * Interpreta textos de execução de sinos: LV / SB (singing bell) / "R to SB" ligam a
   * ressonância livre; R (ring) volta ao toque normal. Retorna true/false ou null se não for marcação.
   */
  static parseLvWords(text) {
    const t = String(text || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (!t) return null;
    if (/\bTO (SB|LV)\b/.test(t)) return true;
    if (/^(LV|L\.V\.|SB|LET VIBRATE)\b/.test(t)) return true;
    if (/^R\b\.?$/.test(t) || t === 'RING') return false;
    return null;
  }

  /**
   * Procura a técnica de uma nota no índice do MusicXML
   */
  lookupXmlTechnique(note, measureIndex, timeStamp) {
    if (!this.xmlTechniques || this.xmlTechniques.size === 0) return null;
    try {
      const pitch = note?.Pitch ?? note?.pitch;
      const freq = pitch?.frequency ?? pitch?.Frequency;
      if (!freq || freq <= 20) return null;
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      const sm = this.osmd?.Sheet?.SourceMeasures?.[measureIndex];
      const abs = sm?.AbsoluteTimestamp ?? sm?.absoluteTimestamp;
      const measureStart = abs ? (abs.RealValue ?? abs.realValue ?? 0) : 0;
      const onsetQ = Math.round((timeStamp - measureStart) * 4 * 1000) / 1000;
      return this.xmlTechniques.get(`${measureIndex}|${onsetQ}|${midi}`) || null;
    } catch (e) {
      return null;
    }
  }

  static getEndReached(iter) {
    if (!iter) return true;
    return iter.endReached ?? iter.EndReached ?? false;
  }

  static getTimestamp(iter) {
    if (!iter) return 0;
    const ts = iter.currentTimeStamp ?? iter.CurrentTimeStamp;
    if (!ts) return 0;
    if (typeof ts.realValue === 'number') return ts.realValue;
    if (typeof ts.RealValue === 'number') return ts.RealValue;
    if (ts.numerator && ts.denominator) return ts.numerator / ts.denominator;
    return 0;
  }

  static getMeasureIndex(iter) {
    if (!iter) return 0;
    return iter.currentMeasureIndex ?? iter.CurrentMeasureIndex ?? 0;
  }

  static getNoteLengthQuarters(note) {
    if (!note) return 1.0;
    const len = note.length ?? note.Length;
    if (len) {
      const rv = len.realValue ?? len.RealValue ?? (len.numerator && len.denominator ? len.numerator / len.denominator : null);
      if (rv !== null && !isNaN(rv)) return rv * 4;
    }
    return 1.0;
  }

  /**
   * Converte a nota interna do OSMD para a oitava científica real (C3 a C7)
   */
  static getScientificPitchName(pitch) {
    if (!pitch) return '';
    const noteNames = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
    const fund = pitch.fundamentalNote ?? pitch.FundamentalNote ?? 0;
    let name = noteNames[fund] || 'C';

    const acc = pitch.accidental ?? pitch.Accidental;
    if (acc === 0 || acc === 'SHARP') name += '#';
    else if (acc === 1 || acc === 'FLAT') name += 'b';

    // O OSMD armazena octave com offset de -3 (ex: C4 tem octave=1, C3 tem octave=0)
    let oct = pitch.octave ?? pitch.Octave ?? 1;
    let realOctave = oct + 3;

    // Validação pela frequência física real se disponível
    const freq = pitch.frequency ?? pitch.Frequency;
    if (freq && freq > 20) {
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      realOctave = Math.floor(midi / 12) - 1;
    }

    return `${name}${realOctave}`;
  }

  /**
   * Detecta técnicas de sinos (LV, Martellato, Shake, Pluck, Damp) a partir de notações do OSMD
   */
  detectNoteTechnique(note, cursor, measureIndex) {
    try {
      // 1. Notações do note
      const notations = note?.Notations || note?.notations || [];
      for (const n of notations) {
        const text = String(n?.name || n?.articulation || n?.technical || '').toLowerCase();
        if (text.includes('martellato') || text.includes('mart')) return 'martellato';
        if (text.includes('shake') || text.includes('sk')) return 'shake';
        if (text.includes('pluck') || text.includes('pl')) return 'pluck';
        if (text.includes('lv') || text.includes('vibrate')) return 'lv';
        if (text.includes('damp')) return 'damp';
      }

      // 2. Directions / Words da medida
      if (this.osmd?.Sheet?.SourceMeasures && this.osmd.Sheet.SourceMeasures[measureIndex]) {
        const sm = this.osmd.Sheet.SourceMeasures[measureIndex];
        const dirs = sm.Directions || sm.directions || [];
        for (const dir of dirs) {
          const words = String(dir?.label || dir?.text || dir?.words || '').toLowerCase();
          if (words.includes('lv') || words.includes('l.v.')) return 'lv';
          if (words.includes('martellato') || words.includes('mart')) return 'martellato';
          if (words.includes('shake') || words.includes('sk')) return 'shake';
          if (words.includes('pluck') || words.includes('pl.')) return 'pluck';
          if (words.includes('damp') || words.includes('d.')) return 'damp';
        }
      }
    } catch (e) {}
    return 'norm';
  }

  /**
   * Analisa a partitura carregada no OSMD e constrói a timeline precisa de forma assíncrona
   */
  async buildTimeline(onProgress = null) {
    if (!this.osmd || !this.osmd.Sheet) {
      this.timeline = [];
      return;
    }

    this.timeline = [];
    const cursor = this.osmd.cursor;
    cursor.reset();

    // Lê o andamento inicial da partitura (<sound tempo> / <metronome>)
    this.baseBpm = 100;
    try {
      const sheet = this.osmd.Sheet;
      const firstMeasure = sheet.SourceMeasures && sheet.SourceMeasures[0];
      const candidates = [
        sheet.playbackManager && sheet.playbackManager.bpm,
        sheet.hasBPMInfo ? (sheet.DefaultStartTempoInBpm ?? sheet.defaultStartTempoInBpm) : null,
        firstMeasure ? (firstMeasure.TempoInBPM ?? firstMeasure.tempoInBPM) : null
      ];
      const bpm = candidates.find(v => typeof v === 'number' && v > 0);
      if (bpm) this.baseBpm = bpm;
    } catch (e) {}
    this.updateEffectiveBpm();

    // Lê fórmula de compasso e quantidade total de compassos
    const totalMeasures = (this.osmd.Sheet.SourceMeasures && this.osmd.Sheet.SourceMeasures.length > 0)
      ? this.osmd.Sheet.SourceMeasures.length
      : 0;
    this.totalMeasures = totalMeasures;

    try {
      if (totalMeasures > 0) {
        const m1 = this.osmd.Sheet.SourceMeasures[0];
        if (m1.ActiveTimeSignature) {
          this.timeSignature = {
            beats: m1.ActiveTimeSignature.Numerator ?? m1.ActiveTimeSignature.numerator ?? 4,
            beatType: m1.ActiveTimeSignature.Denominator ?? m1.ActiveTimeSignature.denominator ?? 4
          };
        }
      }
    } catch (e) {}

    let stepIdx = 0;
    while (!ScorePlayer.getEndReached(cursor.Iterator)) {
      // Cede a CPU para a UI a cada 40 passos para evitar 'Página sem resposta'
      if (stepIdx % 40 === 0) {
        if (typeof onProgress === 'function') {
          const currentMeasure = ScorePlayer.getMeasureIndex(cursor.Iterator) + 1;
          onProgress(currentMeasure, totalMeasures);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const timeStamp = ScorePlayer.getTimestamp(cursor.Iterator);
      const measureIndex = ScorePlayer.getMeasureIndex(cursor.Iterator);
      const measureNumber = measureIndex + 1;

      const notes = cursor.NotesUnderCursor ? cursor.NotesUnderCursor() : [];
      const gNotes = cursor.GNotesUnderCursor ? cursor.GNotesUnderCursor() : [];

      const stepNotes = [];
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (!note) continue;
        if (typeof note.isRest === 'function' && note.isRest()) continue;

        const pitch = note.Pitch ?? note.pitch;
        if (!pitch) continue;

        const pitchShort = ScorePlayer.getScientificPitchName(pitch);
        if (!pitchShort) continue;

        const gNote = gNotes && gNotes[i] ? gNotes[i] : null;
        const noteDurationQuarters = ScorePlayer.getNoteLengthQuarters(note);
        const exactFreq = pitch.frequency ?? pitch.Frequency ?? null;
        const technique = this.lookupXmlTechnique(note, measureIndex, timeStamp)
          || this.detectNoteTechnique(note, cursor, measureIndex);

        stepNotes.push({
          pitchStr: pitchShort,
          pitchObj: pitch,
          exactFreq: exactFreq,
          noteObj: note,
          gNote: gNote,
          durationQuarters: noteDurationQuarters,
          technique: technique,
          isUserBell: this.isUserBell(pitchShort)
        });
      }

      this.timeline.push({
        stepIndex: stepIdx,
        timeStamp: timeStamp,
        measureNumber: measureNumber,
        notes: stepNotes
      });

      stepIdx++;
      cursor.next();
    }

    // Fim de cada compasso (em notas inteiras), para tratar saltos de repetição/casas
    const sourceMeasures = this.osmd.Sheet.SourceMeasures || [];
    const measureEnd = (measureIdx) => {
      const sm = sourceMeasures[measureIdx];
      if (!sm) return null;
      const abs = sm.AbsoluteTimestamp ?? sm.absoluteTimestamp;
      const dur = sm.Duration ?? sm.duration;
      const a = abs ? (abs.RealValue ?? abs.realValue) : null;
      const d = dur ? (dur.RealValue ?? dur.realValue) : null;
      return (typeof a === 'number' && typeof d === 'number') ? a + d : null;
    };

    // Calcula a duração em semínimas (quarters) até o próximo passo
    for (let i = 0; i < this.timeline.length; i++) {
      const current = this.timeline[i];
      const next = this.timeline[i + 1];
      let deltaQuarters = 1.0;

      if (next) {
        // O OSMD informa o tempo absoluto da partitura escrita. Num salto (volta do ritornello
        // ou pulo para a casa 2) o próximo passo não é contíguo: nesse caso o intervalo é o
        // tempo que falta até o fim do compasso atual.
        const curIdx = current.measureNumber - 1;
        const nextIdx = next.measureNumber - 1;
        const contiguous = nextIdx === curIdx || nextIdx === curIdx + 1;
        if (contiguous && next.timeStamp > current.timeStamp) {
          deltaQuarters = (next.timeStamp - current.timeStamp) * 4;
        } else {
          const end = measureEnd(curIdx);
          deltaQuarters = end !== null ? (end - current.timeStamp) * 4 : 0;
        }
        if (deltaQuarters <= 0) deltaQuarters = 0.5;
      } else {
        let maxD = 1.0;
        current.notes.forEach(n => {
          if (n.durationQuarters > maxD) maxD = n.durationQuarters;
        });
        deltaQuarters = maxD;
      }
      // Mudança de andamento no meio da música: o player agenda tudo no andamento
      // inicial (baseBpm), então converte o intervalo para "semínimas no andamento inicial".
      // Ex.: compasso a 92 numa música que começa a 66 → cada semínima dura 66/92.
      const sm = sourceMeasures[current.measureNumber - 1];
      const measureBpm = sm ? (sm.TempoInBPM ?? sm.tempoInBPM) : null;
      current.bpm = (typeof measureBpm === 'number' && measureBpm > 0) ? measureBpm : this.baseBpm;
      current.deltaQuarters = deltaQuarters * (this.baseBpm / current.bpm);
    }

    // Tempo de execução de cada passo (em semínimas) na ordem realmente tocada,
    // já com repetições e casas desenroladas. O agendamento usa este valor, e não o
    // timeStamp da partitura escrita, para não haver silêncio nem atropelo nos saltos.
    let playQuarters = 0;
    for (const step of this.timeline) {
      step.playQuarters = playQuarters;
      playQuarters += step.deltaQuarters;
    }

    cursor.reset();
    cursor.update();
    this.currentStepIndex = 0;
    this.refreshStaticHighlights();
  }

  static normalizePitch(pitchStr) {
    if (!pitchStr) return '';
    let s = pitchStr.toUpperCase().trim();
    const match = s.match(/^([A-G][#B]{0,2})(-?\d+)?$/);
    if (!match) return s;

    let note = match[1];
    let octave = match[2] !== undefined ? parseInt(match[2], 10) : 4;

    const enharmonics = {
      'DB': 'C#',
      'EB': 'D#',
      'GB': 'F#',
      'AB': 'G#',
      'BB': 'A#',
      'B#': 'C',
      'E#': 'F',
      'CB': 'B',
      'FB': 'E'
    };

    if (note === 'B#') {
      note = 'C';
      octave++;
    } else if (note === 'CB') {
      note = 'B';
      octave--;
    } else if (enharmonics[note]) {
      note = enharmonics[note];
    }

    return `${note}${octave}`;
  }

  isUserBell(pitchStr) {
    if (!pitchStr) return false;
    const norm = ScorePlayer.normalizePitch(pitchStr);
    for (const key of this.userBells.keys()) {
      if (ScorePlayer.normalizePitch(key) === norm) return true;
    }
    return false;
  }

  getUserBellConfig(pitchStr) {
    if (!pitchStr) return null;
    const norm = ScorePlayer.normalizePitch(pitchStr);
    for (const [key, val] of this.userBells.entries()) {
      if (ScorePlayer.normalizePitch(key) === norm) return val;
    }
    return null;
  }

  /**
   * Marca visualmente as notas atribuídas ao usuário com marca-texto
   */
  refreshStaticHighlights() {
    if (!this.timeline || this.timeline.length === 0) return;

    if (!this.previouslyMarkedNotes) {
      this.previouslyMarkedNotes = new Set();
    }

    // 1. Reseta apenas as notas que haviam sido marcadas anteriormente
    if (this.previouslyMarkedNotes.size > 0) {
      for (const item of this.previouslyMarkedNotes) {
        if (item.gNote && typeof item.gNote.setColor === 'function') {
          try {
            item.gNote.setColor('#000000', {
              applyToNoteheads: true,
              applyToStem: true
            });
            this.applySVGNoteStyle(item.gNote, 'default');
          } catch (e) {}
        }
      }
      this.previouslyMarkedNotes.clear();
    }

    // Se o usuário não tem nenhum sino selecionado, encerra aqui com zero custo de CPU
    if (!this.userBells || this.userBells.size === 0) return;

    // 2. Marca apenas as notas que pertencem aos sinos do usuário
    for (const step of this.timeline) {
      for (const item of step.notes) {
        item.isUserBell = this.isUserBell(item.pitchStr);
        if (item.isUserBell && item.gNote && typeof item.gNote.setColor === 'function') {
          const bellConf = this.getUserBellConfig(item.pitchStr);
          const markColor = bellConf?.color || '#FFB703';
          try {
            item.gNote.setColor(markColor, {
              applyToNoteheads: true,
              applyToStem: false
            });
            this.applySVGNoteStyle(item.gNote, 'marked', markColor);
            this.previouslyMarkedNotes.add(item);
          } catch (e) {}
        }
      }
    }
  }

  applySVGNoteStyle(gNote, state, color = null) {
    try {
      if (!gNote || typeof gNote.getSVGGElement !== 'function') return;
      const el = gNote.getSVGGElement();
      if (!el) return;

      if (state === 'active') {
        el.classList.add('bell-note-active');
        el.style.filter = `drop-shadow(0 0 10px ${color || '#FF0055'})`;
      } else if (state === 'marked') {
        el.classList.add('bell-note-marked');
        el.classList.remove('bell-note-active');
        el.style.filter = `drop-shadow(0 0 3px ${color || '#FFB703'})`;
      } else {
        el.classList.remove('bell-note-active', 'bell-note-marked');
        el.style.filter = 'none';
      }
    } catch (e) {}
  }

  play(notifySync = true) {
    if (this.isPlaying) return;
    this.audio.init();

    if (this.currentStepIndex >= this.timeline.length) {
      this.currentStepIndex = 0;
      if (this.osmd?.cursor) {
        this.osmd.cursor.reset();
        this.osmd.cursor.show();
      }
    }

    // Se o loop estiver ativo e o cursor estiver antes de loopA, pula direto para o início do loop
    if (this.loopEnabled && this.loopA !== null) {
      const currentM = this.timeline[this.currentStepIndex]?.measureNumber || 1;
      if (currentM < this.loopA || (this.loopB !== null && currentM > this.loopB)) {
        const loopIdx = this.timeline.findIndex(s => s.measureNumber === this.loopA);
        if (loopIdx !== -1) {
          this.currentStepIndex = loopIdx;
          this.syncCursorToStep(loopIdx);
        }
      }
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.stepCursorNeedsAdvance = false;
    this.notifyState();

    if (notifySync && this.onSyncBroadcast && !this.isSyncFollower) {
      const curM = this.timeline[this.currentStepIndex]?.measureNumber || 1;
      this.onSyncBroadcast({
        type: 'play',
        measure: curM,
        tempoMultiplier: this.tempoMultiplier,
        bpm: this.effectiveBpm
      });
    }

    // Se estiver no passo 0, posiciona o cursor no início
    if (this.currentStepIndex === 0 && this.osmd?.cursor) {
      this.osmd.cursor.reset();
      this.osmd.cursor.show();
    }

    if (this.countInEnabled && this.currentStepIndex === 0) {
      this.runCountIn(() => {
        if (this.isPlaying) {
          this.startPlaybackLoop();
        }
      });
    } else {
      this.startPlaybackLoop();
    }
  }

  startPlaybackLoop() {
    if (!this.isPlaying) return;
    const startStep = this.timeline[this.currentStepIndex];
    if (!startStep) {
      this.stop();
      return;
    }

    this.audio.init();
    // 50ms de margem acústica para que o hardware de áudio prepare os buffers
    const audioLeadTimeSec = 0.05;
    this.playbackStartAudioTime = this.audio.ctx.currentTime + audioLeadTimeSec;
    this.playbackStartQuarters = startStep.playQuarters;
    this.stepCursorNeedsAdvance = false;

    this.playbackTimer = setTimeout(() => {
      this.executeStep();
    }, audioLeadTimeSec * 1000);
  }

  runCountIn(onComplete) {
    this.isCountingIn = true;
    const beats = this.timeSignature.beats || 4;
    const quarterDurationSec = 60 / this.effectiveBpm;
    let currentBeat = 1;

    const countInInterval = () => {
      if (!this.isPlaying) {
        this.isCountingIn = false;
        return;
      }

      this.audio.playCountInTick(currentBeat, beats);

      if (this.onStep) {
        this.onStep({
          isCountIn: true,
          beat: currentBeat,
          totalBeats: beats
        });
      }

      if (currentBeat < beats) {
        currentBeat++;
        this.playbackTimer = setTimeout(countInInterval, quarterDurationSec * 1000);
      } else {
        this.playbackTimer = setTimeout(() => {
          this.isCountingIn = false;
          onComplete();
        }, quarterDurationSec * 1000);
      }
    };

    countInInterval();
  }

  /**
   * Executa o passo com timing rigoroso e avanço suave O(1) do cursor
   */
  executeStep() {
    if (!this.isPlaying) return;

    // 0. Restaura notas ativas do passo anterior de forma síncrona
    if (this.lastActiveUserNotes && this.lastActiveUserNotes.length > 0) {
      for (const item of this.lastActiveUserNotes) {
        try {
          const bellConf = this.getUserBellConfig(item.pitchStr);
          const staticColor = bellConf?.color || '#FFB703';
          item.gNote.setColor(staticColor, {
            applyToNoteheads: true,
            applyToStem: false
          });
          this.applySVGNoteStyle(item.gNote, 'marked', staticColor);
        } catch (e) {}
      }
      this.lastActiveUserNotes = [];
    }

    if (this.currentStepIndex >= this.timeline.length) {
      this.stop();
      return;
    }

    const step = this.timeline[this.currentStepIndex];
    const quarterDurationSec = 60 / this.effectiveBpm;
    const stepDurationSec = step.deltaQuarters * quarterDurationSec;

    // Tempo de áudio exato no relógio de hardware (Web Audio API)
    const quartersFromStart = step.playQuarters - this.playbackStartQuarters;
    const targetAudioTime = this.playbackStartAudioTime + (quartersFromStart * quarterDurationSec);

    // 1. Metrônomo com precisão de hardware
    if (this.metronomeEnabled && !this.isCountingIn) {
      const beatProgress = (step.timeStamp * 4) % (this.timeSignature.beats || 4);
      if (Math.abs(beatProgress - Math.round(beatProgress)) < 0.05) {
        const isDownbeat = Math.round(beatProgress) === 0;
        this.audio.playMetronomeClick(isDownbeat, targetAudioTime);
      }
    }

    // 2. Toca as notas do passo com afinação cristalina e técnica acústica
    const userNotesHit = [];
    for (const item of step.notes) {
      const isMine = item.isUserBell;
      const noteDurationSec = Math.max(0.6, item.durationQuarters * quarterDurationSec);

      let shouldPlayAudio = true;
      if (isMine && this.practiceMode === 'mute-mine') {
        shouldPlayAudio = false; // Mudo para tocar ao vivo!
      } else if (!isMine && this.practiceMode === 'solo-mine') {
        shouldPlayAudio = false;
      }

      if (shouldPlayAudio) {
        this.audio.playBell(
          item.pitchStr,
          targetAudioTime,
          noteDurationSec * 1.5,
          0.85,
          isMine,
          item.exactFreq,
          item.technique || 'norm'
        );
      }

      // Mudança dinâmica de cor na partitura
      if (isMine && item.gNote) {
        const bellConf = this.getUserBellConfig(item.pitchStr);
        const activeColor = bellConf?.activeColor || '#FF0055';

        userNotesHit.push({
          pitch: item.pitchStr,
          hand: bellConf?.hand || 'right',
          color: activeColor,
          technique: item.technique || 'norm'
        });

        try {
          item.gNote.setColor(activeColor, {
            applyToNoteheads: true,
            applyToStem: true
          });
          this.applySVGNoteStyle(item.gNote, 'active', activeColor);
          this.lastActiveUserNotes.push(item);
        } catch (e) {}
      }
    }

    // 3. Notifica UI
    if (userNotesHit.length > 0 && this.onUserBellHit) {
      this.onUserBellHit(userNotesHit, step.measureNumber);
    } else if (this.lookaheadNotice && this.onUserBellPrepare) {
      this.checkUpcomingUserNotes(this.currentStepIndex);
    }

    if (this.onStep) {
      this.onStep({
        stepIndex: this.currentStepIndex,
        measureNumber: step.measureNumber,
        notes: step.notes,
        duration: stepDurationSec
      });
    }

    // 4. Posiciona o cursor exatamente no passo atual
    if (this.stepCursorNeedsAdvance && this.osmd?.cursor && !ScorePlayer.getEndReached(this.osmd.cursor.Iterator)) {
      this.osmd.cursor.next();
    }
    this.stepCursorNeedsAdvance = true;

    // 5. Agendamento do próximo passo com relógio de áudio (ou Loop A-B)
    let willLoop = false;
    let nextIndex = this.currentStepIndex + 1;

    if (this.loopEnabled && this.loopA !== null && this.loopB !== null && this.loopB >= this.loopA) {
      if (nextIndex >= this.timeline.length || this.timeline[nextIndex].measureNumber > this.loopB) {
        const loopStartIndex = this.timeline.findIndex(s => s.measureNumber === this.loopA);
        if (loopStartIndex !== -1) {
          willLoop = true;
          nextIndex = loopStartIndex;
        }
      }
    }

    if (willLoop) {
      if (this.acceleratorEnabled) {
        this.tempoMultiplier = Math.min(this.acceleratorMax, +(this.tempoMultiplier + this.acceleratorStep).toFixed(2));
        this.updateEffectiveBpm();
        if (this.onAcceleratorTick) {
          this.onAcceleratorTick(this.tempoMultiplier, this.effectiveBpm);
        }
      }
      if (this.onLoopIteration) {
        this.onLoopIteration(this.loopA, this.loopB, this.tempoMultiplier);
      }

      this.currentStepIndex = nextIndex;
      this.syncCursorToStep(nextIndex);
      this.stepCursorNeedsAdvance = false;

      const loopStartStep = this.timeline[nextIndex];
      this.playbackStartQuarters = loopStartStep.playQuarters;
      this.playbackStartAudioTime = this.audio.ctx.currentTime + stepDurationSec;

      this.playbackTimer = setTimeout(() => {
        this.executeStep();
      }, stepDurationSec * 1000);
      return;
    }

    if (nextIndex >= this.timeline.length) {
      this.currentStepIndex++;
      this.playbackTimer = setTimeout(() => {
        this.stop();
      }, stepDurationSec * 1000);
      return;
    }

    const nextStep = this.timeline[nextIndex];
    const nextQuartersFromStart = nextStep.playQuarters - this.playbackStartQuarters;
    const nextTargetAudioTime = this.playbackStartAudioTime + (nextQuartersFromStart * quarterDurationSec);

    let timeUntilNextStepSec = nextTargetAudioTime - this.audio.ctx.currentTime;
    if (timeUntilNextStepSec < -0.3) {
      // Se houve atraso severo externo (ex: aba congelada em background), resincroniza o relógio
      this.playbackStartAudioTime = this.audio.ctx.currentTime - (nextQuartersFromStart * quarterDurationSec);
      timeUntilNextStepSec = 0;
    }
    const delayMs = Math.max(0, timeUntilNextStepSec * 1000);

    this.currentStepIndex++;
    this.playbackTimer = setTimeout(() => {
      this.executeStep();
    }, delayMs);
  }

  checkUpcomingUserNotes(currIdx) {
    const nextSteps = this.timeline.slice(currIdx + 1, currIdx + 4);
    const upcoming = [];

    for (const step of nextSteps) {
      for (const item of step.notes) {
        if (item.isUserBell) {
          const conf = this.getUserBellConfig(item.pitchStr);
          upcoming.push({
            pitch: item.pitchStr,
            measureNumber: step.measureNumber,
            hand: conf?.hand || 'right'
          });
        }
      }
    }

    if (upcoming.length > 0) {
      this.onUserBellPrepare(upcoming);
    } else {
      this.onUserBellPrepare([]);
    }
  }

  /**
   * Posicionamento explícito do cursor (usado apenas em Seek/salto manual de compasso)
   */
  syncCursorToStep(targetIdx) {
    if (!this.osmd || !this.osmd.cursor) return;
    const cursor = this.osmd.cursor;
    cursor.reset();
    for (let i = 0; i < targetIdx; i++) {
      if (ScorePlayer.getEndReached(cursor.Iterator)) break;
      cursor.next();
    }
    cursor.update();
  }

  pause(notifySync = true) {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isPaused = true;
    if (this.playbackTimer) clearTimeout(this.playbackTimer);
    this.audio.dampAll();
    this.clearRestores();
    this.lastActiveUserNotes = [];
    this.refreshStaticHighlights();
    this.stepCursorNeedsAdvance = false;
    this.notifyState();

    if (notifySync && this.onSyncBroadcast && !this.isSyncFollower) {
      const curM = this.timeline[this.currentStepIndex]?.measureNumber || 1;
      this.onSyncBroadcast({
        type: 'pause',
        measure: curM
      });
    }
  }

  stop(notifySync = true) {
    this.isPlaying = false;
    this.isPaused = false;
    this.isCountingIn = false;
    if (this.playbackTimer) clearTimeout(this.playbackTimer);
    this.clearRestores();
    this.lastActiveUserNotes = [];
    this.audio.dampAll();
    this.currentStepIndex = 0;
    this.stepCursorNeedsAdvance = false;
    if (this.osmd?.cursor) {
      this.osmd.cursor.reset();
      this.osmd.cursor.show();
    }
    this.refreshStaticHighlights();
    this.notifyState();
    if (this.onUserBellPrepare) this.onUserBellPrepare([]);

    if (notifySync && this.onSyncBroadcast && !this.isSyncFollower) {
      this.onSyncBroadcast({
        type: 'stop',
        measure: 1
      });
    }
  }

  seekToMeasure(measureNum, notifySync = true) {
    const targetIdx = this.timeline.findIndex(s => s.measureNumber === measureNum);
    if (targetIdx !== -1) {
      const wasPlaying = this.isPlaying;
      if (wasPlaying) {
        if (this.playbackTimer) clearTimeout(this.playbackTimer);
        this.audio.dampAll();
      }
      this.currentStepIndex = targetIdx;
      this.syncCursorToStep(targetIdx);
      this.refreshStaticHighlights();
      this.stepCursorNeedsAdvance = false;
      this.lastActiveUserNotes = [];
      if (this.onMeasureChange) this.onMeasureChange(measureNum);

      if (notifySync && this.onSyncBroadcast && !this.isSyncFollower) {
        this.onSyncBroadcast({
          type: 'seek',
          measure: measureNum
        });
      }

      if (wasPlaying) {
        this.startPlaybackLoop();
      }
    }
  }

  applySyncCommand(cmd) {
    if (!cmd || !cmd.type) return;
    this.isSyncFollower = true;
    try {
      if (cmd.tempoMultiplier && Math.abs(cmd.tempoMultiplier - this.tempoMultiplier) > 0.02) {
        this.setBpmMultiplier(cmd.tempoMultiplier, false);
      }
      if (cmd.type === 'play') {
        if (cmd.measure && (!this.isPlaying || Math.abs((this.timeline[this.currentStepIndex]?.measureNumber || 0) - cmd.measure) > 1)) {
          this.seekToMeasure(cmd.measure, false);
        }
        if (!this.isPlaying) {
          this.play(false);
        }
      } else if (cmd.type === 'pause') {
        this.pause(false);
        if (cmd.measure) this.seekToMeasure(cmd.measure, false);
      } else if (cmd.type === 'stop') {
        this.stop(false);
      } else if (cmd.type === 'seek') {
        if (cmd.measure) this.seekToMeasure(cmd.measure, false);
      }
    } finally {
      // Deixa pronto para novos comandos
    }
  }

  clearRestores() {
    for (const t of this.activeNoteRestores) {
      clearTimeout(t);
    }
    this.activeNoteRestores = [];
  }

  notifyState() {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        isCountingIn: this.isCountingIn,
        currentStepIndex: this.currentStepIndex,
        totalSteps: this.timeline.length
      });
    }
  }
}

// Exporta globalmente
window.ScorePlayer = ScorePlayer;
