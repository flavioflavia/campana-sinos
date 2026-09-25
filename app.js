/**
 * Campana - Orquestra de Sinos
 * Controlador Principal da Aplicação
 */

(function () {
  'use strict';

  // Instâncias
  let audioEngine = null;
  let scorePlayer = null;
  let osmd = null;

  // Estado da aplicação
  const state = {
    currentScoreUrl: 'scores/hino-da-alegria.musicxml',
    zoom: 1.0,
    userBells: new Map(), // pitch => { color, activeColor, hand, label }
    isRackCollapsed: false,
    ocrSelectedFiles: []
  };

  // Mapa em memória de partituras carregadas localmente pelo usuário
  const localScoresMap = new Map();

  // Definição das oitavas de sinos na mesa (Handbell Rack)
  const bellDefinitions = [
    {
      octave: 3,
      name: 'Oitava 3 (Sinos Graves / Baixos)',
      accidentals: [
        { note: 'C#3', solfege: 'Dó#', step: 'C#', offset: 28 },
        { note: 'D#3', solfege: 'Ré#', step: 'D#', offset: 8 },
        { note: 'F#3', solfege: 'Fá#', step: 'F#', offset: 48 },
        { note: 'G#3', solfege: 'Sol#', step: 'G#', offset: 8 },
        { note: 'A#3', solfege: 'Lá#', step: 'A#', offset: 8 }
      ],
      naturals: [
        { note: 'C3', solfege: 'Dó 3' },
        { note: 'D3', solfege: 'Ré 3' },
        { note: 'E3', solfege: 'Mi 3' },
        { note: 'F3', solfege: 'Fá 3' },
        { note: 'G3', solfege: 'Sol 3' },
        { note: 'A3', solfege: 'Lá 3' },
        { note: 'B3', solfege: 'Si 3' }
      ]
    },
    {
      octave: 4,
      name: 'Oitava 4 (Médios / Pauta Grave)',
      accidentals: [
        { note: 'C#4', solfege: 'Dó#', step: 'C#', offset: 28 },
        { note: 'D#4', solfege: 'Ré#', step: 'D#', offset: 8 },
        { note: 'F#4', solfege: 'Fá#', step: 'F#', offset: 48 },
        { note: 'G#4', solfege: 'Sol#', step: 'G#', offset: 8 },
        { note: 'A#4', solfege: 'Lá#', step: 'A#', offset: 8 }
      ],
      naturals: [
        { note: 'C4', solfege: 'Dó 4' },
        { note: 'D4', solfege: 'Ré 4' },
        { note: 'E4', solfege: 'Mi 4' },
        { note: 'F4', solfege: 'Fá 4' },
        { note: 'G4', solfege: 'Sol 4' },
        { note: 'A4', solfege: 'Lá 4' },
        { note: 'B4', solfege: 'Si 4' }
      ]
    },
    {
      octave: 5,
      name: 'Oitava 5 (Agudos / Melodia)',
      accidentals: [
        { note: 'C#5', solfege: 'Dó#', step: 'C#', offset: 28 },
        { note: 'D#5', solfege: 'Ré#', step: 'D#', offset: 8 },
        { note: 'F#5', solfege: 'Fá#', step: 'F#', offset: 48 },
        { note: 'G#5', solfege: 'Sol#', step: 'G#', offset: 8 },
        { note: 'A#5', solfege: 'Lá#', step: 'A#', offset: 8 }
      ],
      naturals: [
        { note: 'C5', solfege: 'Dó 5' },
        { note: 'D5', solfege: 'Ré 5' },
        { note: 'E5', solfege: 'Mi 5' },
        { note: 'F5', solfege: 'Fá 5' },
        { note: 'G5', solfege: 'Sol 5' },
        { note: 'A5', solfege: 'Lá 5' },
        { note: 'B5', solfege: 'Si 5' }
      ]
    },
    {
      octave: 6,
      name: 'Oitava 6 (Super-Agudos)',
      accidentals: [
        { note: 'C#6', solfege: 'Dó#', step: 'C#', offset: 28 },
        { note: 'D#6', solfege: 'Ré#', step: 'D#', offset: 8 },
        { note: 'F#6', solfege: 'Fá#', step: 'F#', offset: 48 },
        { note: 'G#6', solfege: 'Sol#', step: 'G#', offset: 8 },
        { note: 'A#6', solfege: 'Lá#', step: 'A#', offset: 8 }
      ],
      naturals: [
        { note: 'C6', solfege: 'Dó 6' },
        { note: 'D6', solfege: 'Ré 6' },
        { note: 'E6', solfege: 'Mi 6' },
        { note: 'F6', solfege: 'Fá 6' },
        { note: 'G6', solfege: 'Sol 6' },
        { note: 'A6', solfege: 'Lá 6' },
        { note: 'B6', solfege: 'Si 6' }
      ]
    }
  ];

  // Presets de Tocadores (Ringers) incluindo posições de baixos da Oitava 3
  const ringerPresets = [
    { name: 'Baixos 1 (C3/D3)', notes: ['C3', 'D3'], desc: 'Baixos C3 e D3' },
    { name: 'Baixos 2 (E3/F3)', notes: ['E3', 'F3'], desc: 'Baixos E3 e F3' },
    { name: 'Baixos 3 (G3/A3)', notes: ['G3', 'A3'], desc: 'Baixos G3 e A3' },
    { name: 'Baixos 4 (B3/C4)', notes: ['B3', 'C4'], desc: 'Transição B3 e C4' },
    { name: 'Médios 1 (C4/D4)', notes: ['C4', 'D4'], desc: 'Médios C4 e D4' },
    { name: 'Médios 2 (E4/F4)', notes: ['E4', 'F4'], desc: 'Médios E4 e F4' },
    { name: 'Médios 3 (G4/A4)', notes: ['G4', 'A4'], desc: 'Médios G4 e A4' },
    { name: 'Central (B4/C5)', notes: ['B4', 'C5'], desc: 'Transição B4 e C5' },
    { name: 'Melodia 1 (D5/E5)', notes: ['D5', 'E5'], desc: 'Agudos D5 e E5' },
    { name: 'Melodia 2 (F5/G5)', notes: ['F5', 'G5'], desc: 'Agudos F5 e G5' },
    { name: 'Melodia 3 (A5/B5)', notes: ['A5', 'B5'], desc: 'Altos A5 e B5' },
    { name: 'Sopranos (C6/D6)', notes: ['C6', 'D6'], desc: 'Super-agudos C6 e D6' }
  ];

  // Elementos do DOM
  const dom = {
    btnPlay: document.getElementById('btn-play'),
    btnStop: document.getElementById('btn-stop'),
    scoreSelect: document.getElementById('score-select'),
    fileInput: document.getElementById('file-input'),
    btnUpload: document.getElementById('btn-upload'),
    speedSlider: document.getElementById('speed-slider'),
    speedVal: document.getElementById('speed-val'),
    measureBadgeVal: document.getElementById('measure-badge-val'),
    btnMetronome: document.getElementById('btn-metronome'),
    btnCountIn: document.getElementById('btn-count-in'),
    practiceModeSelect: document.getElementById('practice-mode-select'),
    soundTypeSelect: document.getElementById('sound-type-select'),
    btnZoomIn: document.getElementById('btn-zoom-in'),
    btnZoomOut: document.getElementById('btn-zoom-out'),
    btnZoomReset: document.getElementById('btn-zoom-reset'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    btnToggleRack: document.getElementById('btn-toggle-rack'),
    bellRackPanel: document.getElementById('bell-rack-panel'),
    bellRackBoard: document.getElementById('bell-rack-board'),
    assignedBellsList: document.getElementById('assigned-bells-list'),
    ringersGrid: document.getElementById('ringers-grid'),
    btnClearBells: document.getElementById('btn-clear-bells'),
    hudIndicator: document.getElementById('hud-indicator'),
    hudMessage: document.getElementById('hud-message'),
    hudActiveBells: document.getElementById('hud-active-bells'),
    osmdContainer: document.getElementById('osmd-container'),
    scoreLoading: document.getElementById('score-loading'),
    loadingText: document.getElementById('loading-text'),
    dragOverlay: document.getElementById('drag-drop-overlay'),
    btnHelp: document.getElementById('btn-help'),
    helpModal: document.getElementById('help-modal'),
    btnCloseHelp: document.getElementById('btn-close-help'),
    btnOpenOcr: document.getElementById('btn-open-ocr'),
    btnDeleteScore: document.getElementById('btn-delete-score'),
    ocrModal: document.getElementById('ocr-modal'),
    btnCloseOcr: document.getElementById('btn-close-ocr'),
    btnCancelOcr: document.getElementById('btn-cancel-ocr'),
    ocrDropzone: document.getElementById('ocr-dropzone'),
    ocrFileInput: document.getElementById('ocr-file-input'),
    ocrFilesPreview: document.getElementById('ocr-files-preview'),
    ocrChipsList: document.getElementById('ocr-chips-list'),
    ocrTitleInput: document.getElementById('ocr-title-input'),
    ocrStatus: document.getElementById('ocr-status'),
    ocrStatusText: document.getElementById('ocr-status-text'),
    btnSubmitOcr: document.getElementById('btn-submit-ocr')
  };

  // Inicialização
  window.addEventListener('DOMContentLoaded', async () => {
    initAudioAndPlayer();
    buildBellRackUI();
    buildRingerPresetsUI();
    loadStoredPreferences();
    await loadServerScoresList();
    setupEventListeners();
    initOSMD();
    loadScore(state.currentScoreUrl);
  });

  async function loadServerScoresList() {
    try {
      const res = await fetch('api/list_scores.php?v=' + Date.now());
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.success || !Array.isArray(data.scores)) return;

      const currentVal = dom.scoreSelect.value || state.currentScoreUrl;
      dom.scoreSelect.innerHTML = '';

      let foundCurrent = false;
      for (const item of data.scores) {
        const opt = document.createElement('option');
        opt.value = item.url;
        opt.textContent = item.title;
        if (item.url === currentVal) {
          opt.selected = true;
          foundCurrent = true;
        }
        dom.scoreSelect.appendChild(opt);
      }

      if (!foundCurrent && dom.scoreSelect.options.length > 0) {
        dom.scoreSelect.selectedIndex = 0;
        state.currentScoreUrl = dom.scoreSelect.value;
      } else if (foundCurrent) {
        state.currentScoreUrl = currentVal;
      }
    } catch (err) {
      console.warn('Erro ao carregar lista de partituras do servidor:', err);
    }
  }

  function initAudioAndPlayer() {
    audioEngine = new BellAudioEngine();
    scorePlayer = new ScorePlayer(audioEngine);

    // Callbacks do Player
    scorePlayer.onStateChange = handlePlayerStateChange;
    scorePlayer.onStep = handlePlayerStep;
    scorePlayer.onUserBellHit = handleUserBellHit;
    scorePlayer.onUserBellPrepare = handleUserBellPrepare;
  }

  function initOSMD() {
    try {
      osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(dom.osmdContainer, {
        autoResize: true,
        backend: 'svg',
        drawTitle: true,
        drawSubtitle: true,
        drawComposer: true,
        followCursor: true,
        drawPartNames: true,
        pageFormat: 'A4_P',
        pageBackgroundColor: '#ffffff',
        cursorsOptions: [{ type: 0, color: '#3A86FF', alpha: 0.6, follow: true }]
      });
      scorePlayer.setOSMD(osmd);
    } catch (e) {
      console.error('Erro ao inicializar OSMD:', e);
    }
  }

  function isDirectXmlString(str) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    return trimmed.startsWith('<?xml') ||
           trimmed.startsWith('<score-partwise') ||
           trimmed.startsWith('<score-timewise') ||
           trimmed.startsWith('<!DOCTYPE') ||
           trimmed.includes('<score-partwise') ||
           trimmed.includes('<score-timewise') ||
           trimmed.includes('<part-list>');
  }

  function sanitizeXmlForOsmd(rawXml) {
    if (typeof rawXml !== 'string') return rawXml;
    let xml = rawXml.trim();

    // Remove BOM se presente
    if (xml.charCodeAt(0) === 0xFEFF) {
      xml = xml.substring(1).trim();
    }

    // Se houver declaração XML <?xml ... ?> no meio ou após comentários/espaços, move para o início
    const xmlDeclMatch = xml.match(/<\?xml[^>]*\?>/i);
    if (xmlDeclMatch) {
      const decl = xmlDeclMatch[0];
      const rest = xml.replace(decl, '').trim();
      xml = decl + '\n' + rest;
    } else {
      // Se não tem <?xml ... ?>, adiciona a declaração <?xml obrigatória para o OSMD
      xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
    }

    // Normaliza tags de pitch do MusicXML contra formatações fora do padrão (ex: <step>F#</step>)
    xml = xml
      .replace(/<step>\s*([A-Ga-g])#\s*<\/step>/g, '<step>$1</step><alter>1</alter>')
      .replace(/<step>\s*([A-Ga-g])b\s*<\/step>/g, '<step>$1</step><alter>-1</alter>')
      .replace(/<step>\s*([a-g])\s*<\/step>/g, (m, g) => '<step>' + g.toUpperCase() + '</step>')
      .replace(/<alter>\s*#\s*<\/alter>/g, '<alter>1</alter>')
      .replace(/<alter>\s*b\s*<\/alter>/g, '<alter>-1</alter>')
      .replace(/<alter>\s*\+1\s*<\/alter>/g, '<alter>1</alter>');

    return xml;
  }

  async function parseMusicXmlBuffer(buffer) {
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Arquivo de partitura vazio.');
    }

    const uint8 = new Uint8Array(buffer);
    // Detecta se é arquivo compactado ZIP (.mxl ou .mxml compactado)
    const isZip = uint8.length >= 4 &&
      uint8[0] === 0x50 && uint8[1] === 0x4B &&
      (uint8[2] === 0x03 || uint8[2] === 0x05 || uint8[2] === 0x07) &&
      (uint8[3] === 0x04 || uint8[3] === 0x06 || uint8[3] === 0x08);

    if (isZip) {
      if (window.opensheetmusicdisplay && window.opensheetmusicdisplay.MXLHelper) {
        return await window.opensheetmusicdisplay.MXLHelper.MXLtoXMLstring(buffer);
      }
      throw new Error('Suporte a arquivos compactados (.mxl) não disponível no OSMD.');
    }

    // Arquivo texto MusicXML (.musicxml, .mxml, .xml)
    let text = new TextDecoder('utf-8').decode(uint8);
    const encodingMatch = text.match(/<\?xml[^>]+encoding=["']([^"']+)["']/i);
    if (encodingMatch && encodingMatch[1] && !/utf-?8/i.test(encodingMatch[1])) {
      try {
        text = new TextDecoder(encodingMatch[1]).decode(uint8);
      } catch (e) {
        console.warn('Encoding especificado não suportado diretamente:', encodingMatch[1]);
      }
    }
    return text;
  }

  async function loadScore(source, isDirectData = false) {
    if (!source) return;
    showLoading('Carregando partitura...');
    scorePlayer.stop();

    await new Promise(r => setTimeout(r, 20));

    try {
      let xmlContent = '';

      if (localScoresMap.has(source)) {
        xmlContent = localScoresMap.get(source).xml;
      } else if (source instanceof Blob || source instanceof File) {
        const buffer = await source.arrayBuffer();
        xmlContent = await parseMusicXmlBuffer(buffer);
      } else if (isDirectData || isDirectXmlString(source)) {
        xmlContent = source;
      } else if (typeof source === 'string') {
        const fetchUrl = source + (source.includes('?') ? '&' : '?') + 'v=' + Date.now();
        const res = await fetch(fetchUrl);
        if (!res.ok) {
          throw new Error(`Falha HTTP ${res.status} ao obter partitura (${source})`);
        }
        const buffer = await res.arrayBuffer();
        xmlContent = await parseMusicXmlBuffer(buffer);
      } else {
        throw new Error('Origem de partitura inválida ou formato desconhecido.');
      }

      xmlContent = sanitizeXmlForOsmd(xmlContent);

      showLoading('Renderizando partitura no estúdio...');
      await new Promise(r => setTimeout(r, 20));

      await osmd.load(xmlContent);
      osmd.zoom = state.zoom;
      osmd.render();

      // Configura o cursor do OSMD
      if (osmd.cursor) {
        osmd.cursor.show();
        osmd.cursor.reset();
      }

      showLoading('Construindo timeline de reprodução...');
      await new Promise(r => setTimeout(r, 10));

      // Constrói a timeline para playback sincronizado de forma assíncrona
      try {
        await scorePlayer.buildTimeline((currentMeasure, totalMeasures) => {
          if (totalMeasures > 0) {
            dom.loadingText.textContent = `Analisando partitura (compasso ${currentMeasure} de ${totalMeasures})...`;
          }
        });
      } catch (timelineErr) {
        console.error('Aviso na timeline:', timelineErr);
      }

      // Permite clicar diretamente em qualquer nota da partitura para marcar o sino (em lotes não-bloqueantes)
      attachNoteClickListeners();

      // Atualiza controles de BPM com o tempo da partitura
      updateBpmUI();
      hideLoading();

      const totalPages = (osmd && osmd.GraphicSheet && osmd.GraphicSheet.MusicPages) ? osmd.GraphicSheet.MusicPages.length : 1;
      const totalMeasures = (scorePlayer && scorePlayer.totalMeasures) ? `${scorePlayer.totalMeasures} compassos` : '';
      const summaryInfo = [
        totalPages > 1 ? `${totalPages} folhas/páginas` : '1 folha',
        totalMeasures
      ].filter(Boolean).join(', ');

      setHudMessage(`Partitura pronta para estudo (${summaryInfo}). Marque seus sinos e aperte Play!`, 'ready');
    } catch (err) {
      console.error('Erro ao renderizar partitura:', err);
      hideLoading();
      alert('Não foi possível carregar a partitura: ' + (err.message || err));
    }
  }

  function attachNoteClickListeners() {
    if (!scorePlayer || !scorePlayer.timeline || scorePlayer.timeline.length === 0) return;

    const timeline = scorePlayer.timeline;
    let idx = 0;
    const batchSize = 100;

    function processBatch() {
      const end = Math.min(idx + batchSize, timeline.length);
      for (let i = idx; i < end; i++) {
        const step = timeline[i];
        for (const item of step.notes) {
          try {
            if (item.gNote && typeof item.gNote.getSVGGElement === 'function') {
              const el = item.gNote.getSVGGElement();
              if (el && !el.dataset.hasBellClick) {
                el.dataset.hasBellClick = 'true';
                el.style.cursor = 'pointer';
                el.title = `Sino: ${item.pitchStr} (Clique para marcar/desmarcar)`;

                el.addEventListener('click', (e) => {
                  e.stopPropagation();
                  audioEngine.init();
                  audioEngine.playBell(item.pitchStr, null, 2.0, 0.9);
                  toggleBellSelection(item.pitchStr);
                });
              }
            }
          } catch (e) {}
        }
      }
      idx = end;
      if (idx < timeline.length) {
        if (window.requestIdleCallback) {
          window.requestIdleCallback(processBatch);
        } else {
          setTimeout(processBatch, 10);
        }
      }
    }

    processBatch();
  }

  // Constrói a Mesa de Sinos Interativa (Bell Rack)
  function buildBellRackUI() {
    dom.bellRackBoard.innerHTML = '';

    bellDefinitions.forEach(oct => {
      const groupEl = document.createElement('div');
      groupEl.className = 'bell-octave-group';

      const titleEl = document.createElement('div');
      titleEl.className = 'bell-octave-title';
      titleEl.textContent = oct.name;
      groupEl.appendChild(titleEl);

      // Linha de Sustenidos / Acidentes
      const rowAcc = document.createElement('div');
      rowAcc.className = 'bell-row-accidentals';
      oct.accidentals.forEach(acc => {
        const item = createBellItemElement(acc.note, acc.solfege, true);
        rowAcc.appendChild(item);
      });
      groupEl.appendChild(rowAcc);

      // Linha de Naturais
      const rowNat = document.createElement('div');
      rowNat.className = 'bell-row-naturals';
      oct.naturals.forEach(nat => {
        const item = createBellItemElement(nat.note, nat.solfege, false);
        rowNat.appendChild(item);
      });
      groupEl.appendChild(rowNat);

      dom.bellRackBoard.appendChild(groupEl);
    });
  }

  function createBellItemElement(noteStr, solfege, isAccidental) {
    const el = document.createElement('div');
    el.className = `bell-item ${isAccidental ? 'accidental' : 'natural'}`;
    el.dataset.note = noteStr;

    el.innerHTML = `
      <span class="bell-note-name">${noteStr}</span>
      <span class="bell-note-solfege">${solfege}</span>
    `;

    el.addEventListener('click', () => {
      // Toca o som do sino
      audioEngine.init();
      audioEngine.playBell(noteStr, null, 2.0, 0.9);
      el.classList.add('playing-sound');
      setTimeout(() => el.classList.remove('playing-sound'), 300);

      // Alterna seleção do sino
      toggleBellSelection(noteStr);
    });

    return el;
  }

  function buildRingerPresetsUI() {
    dom.ringersGrid.innerHTML = '';
    ringerPresets.forEach((preset, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn-ringer-preset';
      btn.innerHTML = `
        <span class="preset-name">${preset.name}</span>
        <span class="preset-notes">${preset.notes.join(' & ')}</span>
      `;
      btn.addEventListener('click', () => {
        applyRingerPreset(preset.notes);
      });
      dom.ringersGrid.appendChild(btn);
    });
  }

  function toggleBellSelection(noteStr) {
    if (state.userBells.has(noteStr)) {
      state.userBells.delete(noteStr);
    } else {
      // Determina cor e mão (se já tem 1 nota, a segunda pode ser mão esquerda com cor diferente)
      const currentCount = state.userBells.size;
      const isSecond = currentCount % 2 === 1;
      
      const config = {
        color: isSecond ? '#00F5D4' : '#FFD166',
        activeColor: isSecond ? '#7000FF' : '#FF0055',
        hand: isSecond ? 'left' : 'right',
        label: noteStr
      };
      state.userBells.set(noteStr, config);
    }

    updateBellRackSelectionUI();
    renderAssignedBellsList();
    scorePlayer.setUserBells(state.userBells);
    savePreferences();
  }

  function applyRingerPreset(notes) {
    state.userBells.clear();
    notes.forEach((note, idx) => {
      const isLeft = idx === 1;
      state.userBells.set(note, {
        color: isLeft ? '#00F5D4' : '#FFD166',
        activeColor: isLeft ? '#7000FF' : '#FF0055',
        hand: isLeft ? 'left' : 'right',
        label: note
      });
    });

    updateBellRackSelectionUI();
    renderAssignedBellsList();
    scorePlayer.setUserBells(state.userBells);
    savePreferences();

    setHudMessage(`Sinos do ${notes.join(' e ')} atribuídos para você!`, 'ready');
  }

  function updateBellRackSelectionUI() {
    const allBells = dom.bellRackBoard.querySelectorAll('.bell-item');
    allBells.forEach(el => {
      const note = el.dataset.note;
      if (state.userBells.has(note)) {
        const conf = state.userBells.get(note);
        el.classList.add('selected');
        el.style.setProperty('--selected-color', conf.color);
      } else {
        el.classList.remove('selected');
        el.style.removeProperty('--selected-color');
      }
    });
  }

  function renderAssignedBellsList() {
    dom.assignedBellsList.innerHTML = '';

    if (state.userBells.size === 0) {
      dom.assignedBellsList.innerHTML = '<div class="assigned-empty">Nenhum sino marcado. Clique nos sinos abaixo ou em um Tocador para começar.</div>';
      return;
    }

    for (const [note, conf] of state.userBells.entries()) {
      const card = document.createElement('div');
      card.className = 'assigned-card';
      const handText = conf.hand === 'left' ? 'M.E.' : 'M.D.';

      card.innerHTML = `
        <span class="assigned-card-badge" style="background-color: ${conf.color};"></span>
        <span class="assigned-card-note">${note}</span>
        <span class="assigned-card-hand" title="Alternar Mão Direita / Esquerda">${handText}</span>
        <button class="assigned-card-remove" title="Remover sino">&times;</button>
      `;

      // Alternar mão ao clicar na etiqueta
      card.querySelector('.assigned-card-hand').addEventListener('click', () => {
        conf.hand = conf.hand === 'left' ? 'right' : 'left';
        renderAssignedBellsList();
        savePreferences();
      });

      // Remover sino
      card.querySelector('.assigned-card-remove').addEventListener('click', () => {
        state.userBells.delete(note);
        updateBellRackSelectionUI();
        renderAssignedBellsList();
        scorePlayer.setUserBells(state.userBells);
        savePreferences();
      });

      dom.assignedBellsList.appendChild(card);
    }
  }

  // Eventos do Player
  function handlePlayerStateChange(st) {
    if (st.isPlaying) {
      dom.btnPlay.innerHTML = '⏸';
      dom.btnPlay.title = 'Pausar (Espaço)';
      dom.btnPlay.classList.add('playing');
    } else {
      dom.btnPlay.innerHTML = '▶';
      dom.btnPlay.title = 'Tocar (Espaço)';
      dom.btnPlay.classList.remove('playing');
    }
  }

  function handlePlayerStep(info) {
    if (info.isCountIn) {
      dom.measureBadgeVal.textContent = `Contagem ${info.beat}/${info.totalBeats}`;
      setHudMessage(`Prepare-se... ${info.beat} de ${info.totalBeats}!`, 'prepare');
      return;
    }

    dom.measureBadgeVal.textContent = `C. ${info.measureNumber}`;
  }

  function handleUserBellHit(hitNotes, measureNum) {
    // Muda a cor e pulsa o HUD e os sinos
    dom.hudActiveBells.innerHTML = '';

    hitNotes.forEach(item => {
      const chip = document.createElement('span');
      chip.className = 'hud-bell-chip striking';
      chip.style.backgroundColor = item.color;
      chip.textContent = `🔔 TOQUE: ${item.pitch} (${item.hand === 'left' ? 'M.E.' : 'M.D.'})`;
      dom.hudActiveBells.appendChild(chip);

      // Animação na mesa de sinos correspondente
      const bellEl = dom.bellRackBoard.querySelector(`.bell-item[data-note="${item.pitch}"]`);
      if (bellEl) {
        bellEl.classList.add('playing-sound');
        setTimeout(() => bellEl.classList.remove('playing-sound'), 300);
      }
    });

    setHudMessage(`SEU MOMENTO NO COMPASSO ${measureNum}!`, 'strike');
  }

  function handleUserBellPrepare(upcomingNotes) {
    if (upcomingNotes.length > 0) {
      const first = upcomingNotes[0];
      setHudMessage(`🔔 ATENÇÃO: Seu sino [ ${first.pitch} ] entra no próximo tempo! Levante o sino!`, 'prepare');
    } else {
      if (scorePlayer.isPlaying && !scorePlayer.isCountingIn) {
        setHudMessage(`Tocando... Acompanhe a partitura.`, 'playing');
      }
    }
  }

  function setHudMessage(msg, type = 'normal') {
    dom.hudMessage.textContent = msg;
    dom.hudIndicator.className = 'hud-indicator-dot';

    if (type === 'strike') {
      dom.hudIndicator.classList.add('strike');
      dom.hudMessage.className = 'hud-message highlight-strike';
    } else if (type === 'prepare') {
      dom.hudIndicator.classList.add('ready');
      dom.hudMessage.className = 'hud-message highlight-prepare';
    } else {
      dom.hudMessage.className = 'hud-message';
    }
  }

  function updateBpmUI() {
    dom.speedVal.textContent = `${scorePlayer.effectiveBpm} BPM (${Math.round(scorePlayer.tempoMultiplier * 100)}%)`;
    dom.speedSlider.value = scorePlayer.tempoMultiplier;
  }

  function setupEventListeners() {
    // Play / Pause
    dom.btnPlay.addEventListener('click', () => {
      if (scorePlayer.isPlaying) {
        scorePlayer.pause();
      } else {
        scorePlayer.play();
      }
    });

    // Stop
    dom.btnStop.addEventListener('click', () => {
      scorePlayer.stop();
      dom.measureBadgeVal.textContent = 'C. 1';
      setHudMessage('Execução parada. Pronto para recomeçar.', 'ready');
      dom.hudActiveBells.innerHTML = '';
    });

    // Seletor de Partituras Demonstrativas
    dom.scoreSelect.addEventListener('change', (e) => {
      state.currentScoreUrl = e.target.value;
      if (localScoresMap.has(state.currentScoreUrl)) {
        loadScore(localScoresMap.get(state.currentScoreUrl).xml, true);
      } else {
        loadScore(state.currentScoreUrl);
      }
      savePreferences();
    });

    // Exclusão de Partitura selecionada
    if (dom.btnDeleteScore) {
      dom.btnDeleteScore.addEventListener('click', async () => {
        const selectedOpt = dom.scoreSelect.options[dom.scoreSelect.selectedIndex];
        if (!selectedOpt) return;
        const scoreVal = selectedOpt.value;
        const scoreName = selectedOpt.textContent.trim();

        if (scoreVal === 'scores/hino-da-alegria.musicxml') {
          alert('A partitura padrão "Hino à Alegria" é essencial para o aplicativo e não pode ser apagada.');
          return;
        }

        if (!confirm(`Deseja realmente apagar a partitura "${scoreName}"?`)) {
          return;
        }

        if (localScoresMap.has(scoreVal)) {
          localScoresMap.delete(scoreVal);
        } else if (scoreVal.startsWith('scores/')) {
          try {
            const res = await fetch('api/delete_score.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: scoreVal })
            });
            const data = await res.json();
            if (!data.success) {
              alert('Erro ao apagar no servidor: ' + (data.error || 'Erro desconhecido'));
              return;
            }
          } catch (e) {
            console.error('Falha na requisição de exclusão:', e);
            alert('Erro de conexão ao tentar apagar a partitura do servidor.');
            return;
          }
        }

        selectedOpt.remove();
        dom.scoreSelect.selectedIndex = 0;
        state.currentScoreUrl = dom.scoreSelect.value;
        loadScore(state.currentScoreUrl);
        savePreferences();
        setHudMessage(`Partitura "${scoreName}" apagada com sucesso.`, 'normal');
      });
    }

    // Upload de Partituras
    dom.btnUpload.addEventListener('click', () => {
      dom.fileInput.click();
    });

    dom.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      handleFileUpload(file);
    });

    // Drag and drop em tela cheia
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      dom.dragOverlay.classList.add('active');
    });

    dom.dragOverlay.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dom.dragOverlay.classList.remove('active');
    });

    dom.dragOverlay.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.dragOverlay.classList.remove('active');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    });

    // Slider de Velocidade
    dom.speedSlider.addEventListener('input', (e) => {
      const factor = parseFloat(e.target.value);
      scorePlayer.setBpmMultiplier(factor);
      updateBpmUI();
    });

    // Botões de Presets de Velocidade (0.5x, 0.75x, 1x, 1.25x)
    document.querySelectorAll('.btn-speed-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-speed-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const factor = parseFloat(btn.dataset.speed);
        scorePlayer.setBpmMultiplier(factor);
        updateBpmUI();
      });
    });

    // Metrônomo
    dom.btnMetronome.addEventListener('click', () => {
      scorePlayer.metronomeEnabled = !scorePlayer.metronomeEnabled;
      dom.btnMetronome.classList.toggle('active', scorePlayer.metronomeEnabled);
      savePreferences();
    });

    // Contagem Inicial
    dom.btnCountIn.addEventListener('click', () => {
      scorePlayer.countInEnabled = !scorePlayer.countInEnabled;
      dom.btnCountIn.classList.toggle('active', scorePlayer.countInEnabled);
      savePreferences();
    });

    // Modo de Prática
    dom.practiceModeSelect.addEventListener('change', (e) => {
      scorePlayer.setPracticeMode(e.target.value);
      savePreferences();
    });

    // Timbre do Sino
    dom.soundTypeSelect.addEventListener('change', (e) => {
      audioEngine.setSoundType(e.target.value);
      savePreferences();
    });

    // Zoom
    dom.btnZoomIn.addEventListener('click', () => {
      state.zoom = Math.min(2.0, state.zoom + 0.15);
      applyZoom();
    });

    dom.btnZoomOut.addEventListener('click', () => {
      state.zoom = Math.max(0.5, state.zoom - 0.15);
      applyZoom();
    });

    dom.btnZoomReset.addEventListener('click', () => {
      state.zoom = 1.0;
      applyZoom();
    });

    // Tela Cheia
    dom.btnFullscreen.addEventListener('click', () => {
      toggleFullscreen();
    });

    // Toggle da Mesa de Sinos
    dom.btnToggleRack.addEventListener('click', () => {
      state.isRackCollapsed = !state.isRackCollapsed;
      dom.bellRackPanel.classList.toggle('collapsed', state.isRackCollapsed);
      dom.btnToggleRack.classList.toggle('active', !state.isRackCollapsed);
    });

    // Limpar Sinos
    dom.btnClearBells.addEventListener('click', () => {
      state.userBells.clear();
      updateBellRackSelectionUI();
      renderAssignedBellsList();
      scorePlayer.setUserBells(state.userBells);
      savePreferences();
      setHudMessage('Todos os sinos foram desmarcados.', 'normal');
    });

    // Modal de Ajuda
    dom.btnHelp.addEventListener('click', () => dom.helpModal.classList.add('open'));
    dom.btnCloseHelp.addEventListener('click', () => dom.helpModal.classList.remove('open'));
    dom.helpModal.addEventListener('click', (e) => {
      if (e.target === dom.helpModal) dom.helpModal.classList.remove('open');
    });

    // Modal de OCR (Gemini Vision)
    setupOcrModal();

    // Atalhos de Teclado
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        dom.btnPlay.click();
      } else if (e.code === 'Escape') {
        scorePlayer.stop();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        dom.btnMetronome.click();
      }
    });
  }

  function applyZoom() {
    if (osmd) {
      osmd.zoom = state.zoom;
      osmd.render();
      scorePlayer.refreshStaticHighlights();
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;

    // Se o usuário arrastou/enviou imagem de partitura, abre o modal de IA Gemini
    const ext = file.name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      if (dom.ocrModal) {
        dom.ocrModal.classList.add('open');
        addOcrFiles([file]);
      }
      return;
    }

    showLoading(`Lendo e decodificando "${file.name}"...`);
    await new Promise(r => setTimeout(r, 20));

    try {
      const buffer = await file.arrayBuffer();
      const rawXml = await parseMusicXmlBuffer(buffer);
      const sanitizedXml = sanitizeXmlForOsmd(rawXml);

      let scoreKey = 'custom_' + Date.now();
      let scoreTitle = file.name;

      // Salva a partitura no servidor de forma permanente para resistir a CTRL+F5 e recarregamento
      showLoading(`Salvando "${file.name}" na biblioteca do servidor...`);
      try {
        const uploadRes = await fetch('api/upload_score.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            content: sanitizedXml,
            title: file.name.replace(/\.[^/.]+$/, '')
          })
        });
        const uploadData = await uploadRes.json();
        if (uploadData && uploadData.success && uploadData.filename) {
          scoreKey = uploadData.filename;
          scoreTitle = uploadData.title || file.name;
        }
      } catch (uploadErr) {
        console.warn('Não foi possível salvar no servidor, mantendo na memória da sessão:', uploadErr);
      }

      // Armazena no mapa local em memória para carregamento imediato
      localScoresMap.set(scoreKey, {
        name: scoreTitle,
        xml: sanitizedXml
      });

      addNewOptionToSelect(scoreTitle, scoreKey);
      state.currentScoreUrl = scoreKey;
      savePreferences();

      await loadScore(sanitizedXml, true);
    } catch (err) {
      console.error('Erro ao ler arquivo de partitura:', err);
      hideLoading();
      alert(`Não foi possível carregar a partitura "${file.name}":\n${err.message || err}`);
    } finally {
      if (dom.fileInput) {
        dom.fileInput.value = '';
      }
    }
  }

  function addNewOptionToSelect(name, value = 'custom') {
    for (let i = 0; i < dom.scoreSelect.options.length; i++) {
      if (dom.scoreSelect.options[i].value === value) {
        dom.scoreSelect.options[i].selected = true;
        return;
      }
    }
    const opt = document.createElement('option');
    opt.value = value;
    const hasIcon = name.startsWith('📁') || name.startsWith('🎵') || name.startsWith('🎼') || name.startsWith('✨') || name.startsWith('🏰') || name.startsWith('🌟') || name.startsWith('⛪');
    opt.textContent = hasIcon ? name : `📁 ${name}`;
    opt.selected = true;
    dom.scoreSelect.appendChild(opt);
  }

  // Controle do Modal de OCR (Google Gemini Vision)
  function setupOcrModal() {
    if (!dom.btnOpenOcr || !dom.ocrModal) return;

    dom.btnOpenOcr.addEventListener('click', () => {
      dom.ocrModal.classList.add('open');
    });

    dom.btnCloseOcr.addEventListener('click', () => {
      dom.ocrModal.classList.remove('open');
    });

    dom.btnCancelOcr.addEventListener('click', () => {
      dom.ocrModal.classList.remove('open');
    });

    dom.ocrModal.addEventListener('click', (e) => {
      if (e.target === dom.ocrModal) {
        dom.ocrModal.classList.remove('open');
      }
    });

    // Clique na dropzone abre seleção de arquivos
    dom.ocrDropzone.addEventListener('click', () => {
      dom.ocrFileInput.click();
    });

    // Drag and Drop na dropzone
    dom.ocrDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dom.ocrDropzone.classList.add('dragover');
    });

    dom.ocrDropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dom.ocrDropzone.classList.remove('dragover');
    });

    dom.ocrDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.ocrDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addOcrFiles(Array.from(e.dataTransfer.files));
      }
    });

    // Input de arquivos
    dom.ocrFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addOcrFiles(Array.from(e.target.files));
        dom.ocrFileInput.value = '';
      }
    });

    // Enviar para transcrição com IA
    dom.btnSubmitOcr.addEventListener('click', () => {
      submitOcrTranscription();
    });
  }

  function addOcrFiles(newFiles) {
    const imageFiles = newFiles.filter(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(f.name));
    if (imageFiles.length === 0) {
      alert('Por favor, selecione fotos de folhas de partitura (.jpg, .jpeg, .png, .webp).');
      return;
    }

    state.ocrSelectedFiles = state.ocrSelectedFiles.concat(imageFiles);
    renderOcrFilesPreview();
  }

  function renderOcrFilesPreview() {
    dom.ocrChipsList.innerHTML = '';
    if (state.ocrSelectedFiles.length === 0) {
      dom.ocrFilesPreview.style.display = 'none';
      dom.btnSubmitOcr.disabled = true;
      return;
    }

    dom.ocrFilesPreview.style.display = 'block';
    dom.btnSubmitOcr.disabled = false;

    state.ocrSelectedFiles.forEach((file, idx) => {
      const chip = document.createElement('div');
      chip.className = 'ocr-file-chip';
      chip.innerHTML = `
        <span>📄 Folha ${idx + 1}: ${file.name}</span>
        <span class="ocr-file-chip-remove" title="Remover folha">&times;</span>
      `;
      chip.querySelector('.ocr-file-chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        state.ocrSelectedFiles.splice(idx, 1);
        renderOcrFilesPreview();
      });
      dom.ocrChipsList.appendChild(chip);
    });
  }

  async function submitOcrTranscription() {
    if (state.ocrSelectedFiles.length === 0) return;

    dom.ocrStatus.style.display = 'flex';
    dom.ocrStatusText.textContent = `Enviando ${state.ocrSelectedFiles.length} folha(s) para o Google Gemini Vision... Analisando pautas e claves.`;
    dom.btnSubmitOcr.disabled = true;
    dom.btnCancelOcr.disabled = true;

    const formData = new FormData();
    state.ocrSelectedFiles.forEach((f) => {
      formData.append('images[]', f);
    });
    const titleVal = dom.ocrTitleInput.value.trim();
    if (titleVal) {
      formData.append('title', titleVal);
    }

    try {
      const resp = await fetch('api/transcribe.php', {
        method: 'POST',
        body: formData
      });

      const rawText = await resp.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error('Falha na resposta do servidor: ' + (rawText.substring(0, 80) || 'Erro desconhecido'));
      }

      if (!data.success || !data.jobId) {
        throw new Error(data.error || 'Falha ao iniciar processamento da partitura.');
      }

      const jobId = data.jobId;
      dom.ocrStatusText.textContent = 'Iniciando transcrição com Google Gemini Vision...';

      // Loop de sondagem (polling) a cada 2.5s
      let completed = false;
      const startTime = Date.now();
      const maxTimeoutMs = 10 * 60 * 1000; // 10 minutos limite

      while (!completed) {
        if (Date.now() - startTime > maxTimeoutMs) {
          throw new Error('Tempo limite excedido durante a transcrição.');
        }

        await new Promise(res => setTimeout(res, 2500));

        let statusResp;
        try {
          statusResp = await fetch(`api/transcribe_status.php?jobId=${encodeURIComponent(jobId)}&t=${Date.now()}`);
        } catch (netErr) {
          // Erro temporário de rede na sondagem, continua tentando
          continue;
        }

        if (!statusResp.ok) continue;

        const statusRaw = await statusResp.text();
        let job;
        try {
          job = JSON.parse(statusRaw);
        } catch (e) {
          continue;
        }

        if (job.status === 'processing' || job.status === 'queued') {
          const pct = job.percent !== undefined ? ` (${job.percent}%)` : '';
          dom.ocrStatusText.textContent = (job.message || 'Processando com Gemini Vision...') + pct;
        } else if (job.status === 'completed') {
          completed = true;
          dom.ocrStatusText.textContent = 'Partitura transcrita com sucesso! Carregando no estúdio de sinos...';
          const scoreUrl = job.scoreUrl || ('scores/' + job.filename);
          const scoreTitle = job.title || job.filename;

          addNewOptionToSelect(scoreTitle, scoreUrl);
          state.currentScoreUrl = scoreUrl;
          savePreferences();
          await loadScore(scoreUrl);

          setTimeout(() => {
            dom.ocrModal.classList.remove('open');
            dom.ocrStatus.style.display = 'none';
            dom.btnSubmitOcr.disabled = false;
            dom.btnCancelOcr.disabled = false;
            state.ocrSelectedFiles = [];
            dom.ocrTitleInput.value = '';
            renderOcrFilesPreview();
            setHudMessage(`Partitura "${scoreTitle}" carregada com sucesso!`, 'ready');
          }, 1200);
          return;
        } else if (job.status === 'error') {
          completed = true;
          throw new Error(job.message || job.error || 'Erro durante a transcrição.');
        }
      }
    } catch (err) {
      console.error('Erro no OCR:', err);
      dom.ocrStatusText.textContent = `Erro: ${err.message}`;
      dom.btnSubmitOcr.disabled = false;
      dom.btnCancelOcr.disabled = false;
    }
  }

  function showLoading(msg) {
    dom.loadingText.textContent = msg;
    dom.scoreLoading.style.display = 'flex';
  }

  function hideLoading() {
    dom.scoreLoading.style.display = 'none';
  }

  function savePreferences() {
    try {
      const bellsObj = {};
      for (const [k, v] of state.userBells.entries()) {
        bellsObj[k] = v;
      }
      const prefs = {
        userBells: bellsObj,
        tempoMultiplier: scorePlayer.tempoMultiplier,
        metronomeEnabled: scorePlayer.metronomeEnabled,
        countInEnabled: scorePlayer.countInEnabled,
        practiceMode: scorePlayer.practiceMode,
        soundType: audioEngine.soundType,
        scoreUrl: state.currentScoreUrl
      };
      localStorage.setItem('bellringer_prefs_v1', JSON.stringify(prefs));
    } catch (e) {}
  }

  function loadStoredPreferences() {
    try {
      const raw = localStorage.getItem('bellringer_prefs_v1');
      if (!raw) {
        // Preset inicial padrão para a orquestra: Tocador 5 (D5 e E5)
        applyRingerPreset(['D5', 'E5']);
        return;
      }
      const prefs = JSON.parse(raw);
      if (prefs.userBells) {
        state.userBells.clear();
        for (const [k, v] of Object.entries(prefs.userBells)) {
          // Filtra pitches inválidos ou fora de alcance de versões antigas (ex: B-1, C0, E1)
          const match = k.match(/^([A-G][#B]{0,2})(-?\d+)$/i);
          if (match && parseInt(match[2], 10) >= 2 && parseInt(match[2], 10) <= 7) {
            state.userBells.set(k, v);
          }
        }
        if (state.userBells.size === 0) {
          applyRingerPreset(['D5', 'E5']);
        } else {
          updateBellRackSelectionUI();
          renderAssignedBellsList();
          scorePlayer.setUserBells(state.userBells);
        }
      }

      if (prefs.tempoMultiplier) {
        scorePlayer.setBpmMultiplier(prefs.tempoMultiplier);
        updateBpmUI();
      }

      if (typeof prefs.metronomeEnabled === 'boolean') {
        scorePlayer.metronomeEnabled = prefs.metronomeEnabled;
        dom.btnMetronome.classList.toggle('active', prefs.metronomeEnabled);
      }

      if (typeof prefs.countInEnabled === 'boolean') {
        scorePlayer.countInEnabled = prefs.countInEnabled;
        dom.btnCountIn.classList.toggle('active', prefs.countInEnabled);
      }

      if (prefs.practiceMode) {
        scorePlayer.setPracticeMode(prefs.practiceMode);
        dom.practiceModeSelect.value = prefs.practiceMode;
      }

      if (prefs.soundType) {
        audioEngine.setSoundType(prefs.soundType);
        dom.soundTypeSelect.value = prefs.soundType;
      }

      if (prefs.scoreUrl && (prefs.scoreUrl.startsWith('scores/') || localScoresMap.has(prefs.scoreUrl))) {
        state.currentScoreUrl = prefs.scoreUrl;
        if (dom.scoreSelect) {
          dom.scoreSelect.value = prefs.scoreUrl;
        }
      }
    } catch (e) {}
  }

})();
