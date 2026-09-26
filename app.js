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
    ocrSelectedFiles: [],
    currentUser: null, // { id, name, email, role, isAdmin, avatar_color }
    allRingers: [],
    currentSongRoster: {}, // email => { name, email, bells }
    msfSelectedFile: null
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
    btnPrevMeasure: document.getElementById('btn-prev-measure'),
    btnNextMeasure: document.getElementById('btn-next-measure'),
    btnWakeLock: document.getElementById('btn-wake-lock'),
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
    btnCloseRack: document.getElementById('btn-close-rack'),
    bellRackBackdrop: document.getElementById('bell-rack-backdrop'),
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
    btnSubmitOcr: document.getElementById('btn-submit-ocr'),

    // Perfil do Usuário / Multi-usuário
    btnUserProfile: document.getElementById('btn-user-profile'),
    userAvatarBadge: document.getElementById('user-avatar-badge'),
    userNameLabel: document.getElementById('user-name-label'),
    userRoleTag: document.getElementById('user-role-tag'),
    userModal: document.getElementById('user-modal'),
    btnCloseUserModal: document.getElementById('btn-close-user-modal'),
    btnCloseUserModalAction: document.getElementById('btn-close-user-modal-action'),
    ringersChipsGrid: document.getElementById('ringers-chips-grid'),
    newUserName: document.getElementById('new-user-name'),
    newUserEmail: document.getElementById('new-user-email'),
    btnCreateRinger: document.getElementById('btn-create-ringer'),
    btnShowAdminLogin: document.getElementById('btn-show-admin-login'),
    adminLoginFields: document.getElementById('admin-login-fields'),
    adminPasswordInput: document.getElementById('admin-password-input'),
    btnSubmitAdminLogin: document.getElementById('btn-submit-admin-login'),

    // Conversor de arquivos .MSF (MobileSheets)
    btnOpenMsf: document.getElementById('btn-open-msf'),
    msfModal: document.getElementById('msf-modal'),
    btnCloseMsf: document.getElementById('btn-close-msf'),
    btnCancelMsf: document.getElementById('btn-cancel-msf'),
    msfDropzone: document.getElementById('msf-dropzone'),
    msfFileInput: document.getElementById('msf-file-input'),
    msfSelectedFileInfo: document.getElementById('msf-selected-file-info'),
    msfSelectedFilename: document.getElementById('msf-selected-filename'),
    msfTitleInput: document.getElementById('msf-title-input'),
    msfStatus: document.getElementById('msf-status'),
    msfStatusText: document.getElementById('msf-status-text'),
    btnSubmitMsf: document.getElementById('btn-submit-msf'),

    // Abas e Escala da Música
    tabMyBells: document.getElementById('tab-my-bells'),
    tabGroupRoster: document.getElementById('tab-group-roster'),
    viewMyBells: document.getElementById('view-my-bells'),
    viewGroupRoster: document.getElementById('view-group-roster'),
    groupRosterList: document.getElementById('group-roster-list'),
    assignedSectionHeading: document.getElementById('assigned-section-heading'),
    assignedSaveStatus: document.getElementById('assigned-save-status')
  };

  // Inicialização
  window.addEventListener('DOMContentLoaded', async () => {
    initAudioAndPlayer();
    buildBellRackUI();
    buildRingerPresetsUI();
    loadStoredPreferences();

    await loadCurrentUser();
    setupUserModal();
    setupMsfModal();
    setupPanelTabs();

    // No celular e tablet retrato, a mesa de sinos começa recolhida para dar destaque total à partitura
    if (window.innerWidth <= 991) {
      state.isRackCollapsed = true;
      dom.bellRackPanel.classList.add('collapsed');
      dom.btnToggleRack.classList.remove('active');
    }

    await loadServerScoresList();
    setupEventListeners();
    initOSMD();
    loadScore(state.currentScoreUrl);

    // Ajusta o layout da partitura dinamicamente ao girar o celular (retrato/paisagem)
    window.addEventListener('resize', () => {
      clearTimeout(window._resizeScoreTimer);
      window._resizeScoreTimer = setTimeout(() => {
        if (osmd) {
          try {
            osmd.render();
            scorePlayer.refreshStaticHighlights();
          } catch (e) {}
        }
      }, 250);
    });
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
    scorePlayer.onMeasureChange = (measureNum) => {
      dom.measureBadgeVal.textContent = `C. ${measureNum}`;
    };
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

    // Corrige tags com fechamento incorreto geradas por modelos de IA (ex: <step>B</octave> -> <step>B</step>)
    xml = xml
      .replace(/<step>\s*([A-Ga-g])#\s*<\/[^>]+>/g, '<step>$1</step><alter>1</alter>')
      .replace(/<step>\s*([A-Ga-g])b\s*<\/[^>]+>/g, '<step>$1</step><alter>-1</alter>')
      .replace(/<step>\s*([A-Ga-g])\s*<\/[^>]+>/g, (m, g) => '<step>' + g.toUpperCase() + '</step>')
      .replace(/<octave>\s*(\d+)\s*<\/[^>]+>/g, '<octave>$1</octave>')
      .replace(/<alter>\s*#\s*<\/[^>]+>/g, '<alter>1</alter>')
      .replace(/<alter>\s*b\s*<\/[^>]+>/g, '<alter>-1</alter>')
      .replace(/<alter>\s*\+1\s*<\/[^>]+>/g, '<alter>1</alter>')
      .replace(/<duration>\s*(\d+)\s*<\/[^>]+>/g, '<duration>$1</duration>')
      .replace(/<type>\s*([a-z]+)\s*<\/[^>]+>/g, '<type>$1</type>')
      .replace(/<voice>\s*(\d+)\s*<\/[^>]+>/g, '<voice>$1</voice>')
      .replace(/<staff>\s*(\d+)\s*<\/[^>]+>/g, '<staff>$1</staff>')
      .replace(/<fifths>\s*(-?\d+)\s*<\/[^>]+>/g, '<fifths>$1</fifths>')
      .replace(/<beats>\s*(\d+)\s*<\/[^>]+>/g, '<beats>$1</beats>')
      .replace(/<beat-type>\s*(\d+)\s*<\/[^>]+>/g, '<beat-type>$1</beat-type>')
      .replace(/&nbsp;/g, ' ');

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

      // Carrega os sinos do sineiro e a escala do grupo para esta partitura
      try {
        const scoreId = getCurrentScoreId();
        if (scoreId) {
          await loadSongAssignments(scoreId, true);
        }
      } catch (assignErr) {
        console.warn('Erro ao carregar escala da música:', assignErr);
      }

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
      if (!isWakeLockRequestedByUser) {
        releaseWakeLock();
      }
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

  // Modo Estante / Wake Lock API (para Tablets e Celulares não apagarem a tela)
  let wakeLockSentinel = null;
  let isWakeLockRequestedByUser = false;

  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
          updateWakeLockUI();
        });
        updateWakeLockUI();
        return true;
      } catch (err) {
        console.warn('Wake Lock request error:', err);
        return false;
      }
    }
    return false;
  }

  async function releaseWakeLock() {
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
      } catch (e) {}
      wakeLockSentinel = null;
    }
    updateWakeLockUI();
  }

  function updateWakeLockUI() {
    const isActive = !!wakeLockSentinel || isWakeLockRequestedByUser;
    if (dom.btnWakeLock) {
      dom.btnWakeLock.classList.toggle('active', isActive);
      dom.btnWakeLock.classList.toggle('active-wake', isActive);
    }
  }

  async function toggleWakeLock() {
    if (isWakeLockRequestedByUser) {
      isWakeLockRequestedByUser = false;
      await releaseWakeLock();
      setHudMessage('Modo Estante desativado. A tela seguirá o tempo normal de bloqueio do tablet.', 'normal');
    } else {
      isWakeLockRequestedByUser = true;
      const success = await requestWakeLock();
      if (success) {
        setHudMessage('💡 Modo Estante ativado: a tela do tablet ficará sempre ligada durante o ensaio!', 'ready');
      } else {
        updateWakeLockUI();
        setHudMessage('💡 Modo Estante selecionado. Caso seu tablet não suporte controle automático, ajuste o tempo de bloqueio nas configurações.', 'ready');
      }
    }
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && (isWakeLockRequestedByUser || (scorePlayer && scorePlayer.isPlaying))) {
      await requestWakeLock();
    }
  });

  // Salto de Compassos (Touch / Pedal Bluetooth / Atalhos)
  function jumpMeasure(delta) {
    if (!scorePlayer || !scorePlayer.timeline || scorePlayer.timeline.length === 0) return;
    const curStep = scorePlayer.timeline[scorePlayer.currentStepIndex];
    const curM = curStep ? curStep.measureNumber : 1;
    const targetM = Math.max(1, curM + delta);
    scorePlayer.seekToMeasure(targetM);
    dom.measureBadgeVal.textContent = `C. ${targetM}`;
  }

  function setupEventListeners() {
    function toggleRack(forceState) {
      if (typeof forceState === 'boolean') {
        state.isRackCollapsed = forceState;
      } else {
        state.isRackCollapsed = !state.isRackCollapsed;
      }
      dom.bellRackPanel.classList.toggle('collapsed', state.isRackCollapsed);
      dom.btnToggleRack.classList.toggle('active', !state.isRackCollapsed);
      if (dom.bellRackBackdrop) {
        dom.bellRackBackdrop.classList.toggle('active', !state.isRackCollapsed);
      }
    }

    // Play / Pause
    dom.btnPlay.addEventListener('click', () => {
      if (scorePlayer.isPlaying) {
        scorePlayer.pause();
      } else {
        // No celular e tablet retrato, fecha a mesa de sinos ao dar play para ver a partitura
        if (window.innerWidth <= 991 && !state.isRackCollapsed) {
          toggleRack(true);
        }
        requestWakeLock();
        scorePlayer.play();
      }
    });

    // Stop
    dom.btnStop.addEventListener('click', () => {
      scorePlayer.stop();
      if (!isWakeLockRequestedByUser) {
        releaseWakeLock();
      }
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
        if (!state.currentUser || !state.currentUser.isAdmin) {
          alert('Apenas o administrador (flavioflavia@gmail.com) tem permissão para excluir partituras do acervo.');
          return;
        }

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
              headers: {
                'Content-Type': 'application/json',
                'X-User-Email': state.currentUser ? state.currentUser.email : ''
              },
              body: JSON.stringify({
                filename: scoreVal,
                user_email: state.currentUser ? state.currentUser.email : ''
              })
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
      toggleRack();
    });

    if (dom.btnCloseRack) {
      dom.btnCloseRack.addEventListener('click', () => {
        toggleRack(true);
      });
    }

    if (dom.bellRackBackdrop) {
      dom.bellRackBackdrop.addEventListener('click', () => {
        toggleRack(true);
      });
    }

    // Navegação de Compassos (⏮ Anterior e ⏭ Próximo)
    if (dom.btnPrevMeasure) {
      dom.btnPrevMeasure.addEventListener('click', () => jumpMeasure(-1));
    }
    if (dom.btnNextMeasure) {
      dom.btnNextMeasure.addEventListener('click', () => jumpMeasure(1));
    }

    // Modo Estante / Tela Ativa
    if (dom.btnWakeLock) {
      dom.btnWakeLock.addEventListener('click', () => toggleWakeLock());
    }

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

    // Atalhos de Teclado & Pedais Bluetooth (PageFlip / AirTurn / Coda)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        dom.btnPlay.click();
      } else if (e.code === 'Escape') {
        scorePlayer.stop();
        if (!isWakeLockRequestedByUser) releaseWakeLock();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        dom.btnMetronome.click();
      } else if (e.code === 'ArrowRight' || e.code === 'PageDown' || e.code === 'ArrowDown') {
        e.preventDefault();
        jumpMeasure(1);
      } else if (e.code === 'ArrowLeft' || e.code === 'PageUp' || e.code === 'ArrowUp') {
        e.preventDefault();
        jumpMeasure(-1);
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

    const ext = file.name.split('.').pop().toLowerCase();

    // Se o usuário arrastou/enviou arquivo do MobileSheets (.msf ou .msb), abre o conversor MSF
    if (['msf', 'msb'].includes(ext)) {
      openMsfModalWithFile(file);
      return;
    }

    // Se o usuário arrastou/enviou imagem de partitura, abre o modal de IA Gemini
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
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': state.currentUser ? state.currentUser.email : ''
          },
          body: JSON.stringify({
            filename: file.name,
            content: sanitizedXml,
            title: file.name.replace(/\.[^/.]+$/, ''),
            user_name: state.currentUser ? state.currentUser.name : 'Sineiro',
            user_email: state.currentUser ? state.currentUser.email : ''
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

  // ==========================================
  // IDENTIFICAÇÃO E ESCALA DE SINOS POR MÚSICA
  // ==========================================

  function getCurrentScoreId() {
    const url = state.currentScoreUrl || (dom.scoreSelect ? dom.scoreSelect.value : '');
    if (!url) return 'hino-da-alegria.musicxml';
    return url.replace(/^scores\//, '');
  }

  async function loadSongAssignments(scoreId, silent = false) {
    if (!scoreId) scoreId = getCurrentScoreId();
    if (!scoreId) return;

    const userEmail = state.currentUser ? state.currentUser.email : '';

    try {
      const res = await fetch(`api/assignments.php?action=get_song_assignments&score_id=${encodeURIComponent(scoreId)}&user_email=${encodeURIComponent(userEmail)}&v=${Date.now()}`, {
        headers: {
          'X-User-Email': userEmail
        }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.success) return;

      state.currentSongRoster = data.all_ringers_bells || {};

      // Se este sineiro já tem notas salvas especificamente nesta música, restaura-as
      if (Array.isArray(data.user_bells) && data.user_bells.length > 0) {
        state.userBells.clear();
        data.user_bells.forEach((item, idx) => {
          const note = item.note;
          if (!note) return;
          const isSecond = idx % 2 === 1;
          state.userBells.set(note, {
            color: item.color || (isSecond ? '#00F5D4' : '#FFD166'),
            activeColor: item.activeColor || (isSecond ? '#7000FF' : '#FF0055'),
            hand: item.hand || (isSecond ? 'left' : 'right'),
            label: note
          });
        });

        updateBellRackSelectionUI();
        renderAssignedBellsList();
        scorePlayer.setUserBells(state.userBells);
        if (!silent && state.currentUser) {
          setHudMessage(`Sinos de ${state.currentUser.name} carregados para esta partitura (${data.user_bells.length} sinos).`, 'normal');
        }
      } else {
        // Se mudou para outra partitura e ela ainda não tem sinos deste sineiro
        if (state._lastAssignedScoreId && state._lastAssignedScoreId !== scoreId) {
          state.userBells.clear();
          updateBellRackSelectionUI();
          renderAssignedBellsList();
          scorePlayer.setUserBells(state.userBells);
          if (!silent) {
            setHudMessage('Nenhum sino gravado para você nesta música. Clique nos sinos para marcar.', 'normal');
          }
        } else if (state.userBells.size > 0 && userEmail) {
          // Ponto de partida inicial: grava automaticamente
          saveCurrentSongAssignment(true);
        }
      }
      state._lastAssignedScoreId = scoreId;

      // Atualiza a visão da escala do grupo
      renderGroupRoster(data.all_ringers_bells, data.roster);
    } catch (err) {
      console.warn('Erro ao carregar atribuições da música:', err);
    }
  }

  let _saveAssignmentTimer = null;
  function scheduleSaveSongAssignment() {
    clearTimeout(_saveAssignmentTimer);
    _saveAssignmentTimer = setTimeout(() => {
      saveCurrentSongAssignment(false);
    }, 600);
  }

  async function saveCurrentSongAssignment(silent = false) {
    const scoreId = getCurrentScoreId();
    if (!scoreId || !state.currentUser || !state.currentUser.email) return;

    const bellsList = [];
    for (const [note, conf] of state.userBells.entries()) {
      bellsList.push({
        note: note,
        hand: conf.hand || 'both',
        color: conf.color || null,
        activeColor: conf.activeColor || null
      });
    }

    if (dom.assignedSaveStatus && !silent) {
      dom.assignedSaveStatus.style.display = 'block';
      dom.assignedSaveStatus.textContent = 'Salvando notas na nuvem...';
    }

    try {
      const res = await fetch('api/assignments.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': state.currentUser.email
        },
        body: JSON.stringify({
          score_id: scoreId,
          user_email: state.currentUser.email,
          user_name: state.currentUser.name,
          bells: bellsList
        })
      });

      const data = await res.json();
      if (data && data.success) {
        if (dom.assignedSaveStatus) {
          dom.assignedSaveStatus.style.display = 'block';
          dom.assignedSaveStatus.textContent = '💾 Notas salvas para esta música ✓';
          clearTimeout(dom.assignedSaveStatus._hideTimer);
          dom.assignedSaveStatus._hideTimer = setTimeout(() => {
            if (dom.assignedSaveStatus) dom.assignedSaveStatus.style.display = 'none';
          }, 2500);
        }

        // Atualiza a escala localmente
        if (!state.currentSongRoster) state.currentSongRoster = {};
        state.currentSongRoster[state.currentUser.email] = {
          name: state.currentUser.name,
          email: state.currentUser.email,
          bells: bellsList
        };
        renderGroupRoster(state.currentSongRoster, null);
      }
    } catch (err) {
      console.warn('Erro ao salvar escala na nuvem:', err);
    }
  }

  function renderGroupRoster(allRingersBells, rosterSummary) {
    if (!dom.groupRosterList) return;
    dom.groupRosterList.innerHTML = '';

    const ringers = allRingersBells ? Object.values(allRingersBells) : [];
    const activeRingers = ringers.filter(r => Array.isArray(r.bells) && r.bells.length > 0);

    // Atualiza contador na aba
    if (dom.tabGroupRoster) {
      dom.tabGroupRoster.innerHTML = `<span>👥</span> Escala da Música (${activeRingers.length})`;
    }

    if (activeRingers.length === 0) {
      dom.groupRosterList.innerHTML = `
        <div class="roster-empty" style="text-align: center; padding: 24px 12px; color: var(--text-dim); font-size: 0.85rem;">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">🔔</div>
          Nenhum sineiro marcou notas para esta música ainda.<br>
          Marque seus sinos na aba <strong>Meus Sinos</strong> para compor a escala do grupo!
        </div>
      `;
      return;
    }

    activeRingers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    activeRingers.forEach(ringer => {
      const card = document.createElement('div');
      card.className = 'roster-ringer-card';
      const isMe = state.currentUser && (ringer.email && ringer.email.toLowerCase() === state.currentUser.email.toLowerCase());

      const bellsHtml = ringer.bells.map(b => {
        const noteName = typeof b === 'string' ? b : (b.note || '');
        const hand = typeof b === 'object' && b.hand ? (b.hand === 'left' ? 'M.E.' : b.hand === 'right' ? 'M.D.' : '') : '';
        const color = (typeof b === 'object' && b.color) ? b.color : '#ffd700';
        return `
          <span class="roster-bell-chip" style="border-left: 3px solid ${color};">
            <strong>${noteName}</strong>
            ${hand ? `<small class="roster-hand-tag">${hand}</small>` : ''}
          </span>
        `;
      }).join('');

      card.innerHTML = `
        <div class="roster-ringer-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="user-avatar-badge" style="width: 28px; height: 28px; font-size: 0.75rem; background-color: ${isMe ? 'var(--bell-gold)' : '#3a4a5e'};">
              ${(ringer.name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <span class="roster-ringer-name" style="font-weight: 600; font-size: 0.88rem; color: #fff;">
                ${ringer.name}
              </span>
              ${isMe ? '<span class="roster-me-badge" style="margin-left: 6px; font-size: 0.7rem; background: var(--bg-tertiary); color: var(--bell-gold); padding: 2px 6px; border-radius: 4px;">Você</span>' : ''}
            </div>
          </div>
          <span class="roster-count-badge" style="font-size: 0.75rem; color: var(--text-dim); background: var(--bg-primary); padding: 2px 8px; border-radius: 10px;">
            ${ringer.bells.length} sino${ringer.bells.length > 1 ? 's' : ''}
          </span>
        </div>
        <div class="roster-ringer-bells" style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${bellsHtml}
        </div>
      `;

      dom.groupRosterList.appendChild(card);
    });
  }

  function setupPanelTabs() {
    if (!dom.tabMyBells || !dom.tabGroupRoster) return;

    dom.tabMyBells.addEventListener('click', () => {
      dom.tabMyBells.classList.add('active');
      dom.tabGroupRoster.classList.remove('active');
      if (dom.viewMyBells) dom.viewMyBells.style.display = 'block';
      if (dom.viewGroupRoster) dom.viewGroupRoster.style.display = 'none';
    });

    dom.tabGroupRoster.addEventListener('click', () => {
      dom.tabGroupRoster.classList.add('active');
      dom.tabMyBells.classList.remove('active');
      if (dom.viewMyBells) dom.viewMyBells.style.display = 'none';
      if (dom.viewGroupRoster) dom.viewGroupRoster.style.display = 'block';
      const scoreId = getCurrentScoreId();
      if (scoreId) {
        loadSongAssignments(scoreId, true);
      }
    });
  }

  // ==========================================
  // MULTI-USUÁRIO E PERFIS DE SINEIROS
  // ==========================================

  async function loadCurrentUser() {
    const storedEmail = localStorage.getItem('sinos_current_user_email') || '';
    try {
      const res = await fetch('api/auth.php?action=get_current&v=' + Date.now(), {
        headers: {
          'X-User-Email': storedEmail
        }
      });
      const data = await res.json();
      if (data && data.success) {
        if (data.user) {
          state.currentUser = data.user;
        } else if (data.suggested_user) {
          state.currentUser = data.suggested_user;
        }
      }
    } catch (err) {
      console.warn('Erro ao obter usuário atual:', err);
    }

    if (!state.currentUser) {
      state.currentUser = {
        id: 'u_admin',
        name: 'Flávio (Admin)',
        email: 'flavioflavia@gmail.com',
        role: 'admin',
        isAdmin: true,
        avatar_color: '#ffd700'
      };
    }

    localStorage.setItem('sinos_current_user_email', state.currentUser.email);
    updateUserUI();
  }

  function updateUserUI() {
    if (!state.currentUser) return;
    const u = state.currentUser;

    if (dom.userAvatarBadge) {
      dom.userAvatarBadge.textContent = (u.name || 'S').charAt(0).toUpperCase();
      if (u.avatar_color) {
        dom.userAvatarBadge.style.backgroundColor = u.avatar_color;
      }
    }

    if (dom.userNameLabel) {
      dom.userNameLabel.textContent = u.name;
    }

    if (dom.userRoleTag) {
      dom.userRoleTag.textContent = u.isAdmin ? 'Admin' : 'Sineiro';
      dom.userRoleTag.classList.toggle('badge-admin', !!u.isAdmin);
    }

    // Regra estrita: O botão de exclusão só é visível para o Admin
    if (dom.btnDeleteScore) {
      dom.btnDeleteScore.style.display = u.isAdmin ? 'inline-flex' : 'none';
    }

    if (dom.assignedSectionHeading) {
      dom.assignedSectionHeading.textContent = `Notas de ${u.name} nesta Música`;
    }
  }

  async function refreshRingersList() {
    if (!dom.ringersChipsGrid) return;
    dom.ringersChipsGrid.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem;">Carregando sineiros...</div>';

    try {
      const res = await fetch('api/auth.php?action=list_ringers&v=' + Date.now());
      const data = await res.json();
      if (!data || !data.success || !Array.isArray(data.ringers)) return;

      state.allRingers = data.ringers;
      dom.ringersChipsGrid.innerHTML = '';

      data.ringers.forEach(ringer => {
        const isCurrent = state.currentUser && (ringer.email.toLowerCase() === state.currentUser.email.toLowerCase());
        const chip = document.createElement('div');
        chip.className = `ringer-profile-card ${isCurrent ? 'active' : ''}`;
        chip.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: ${isCurrent ? 'rgba(255, 215, 0, 0.15)' : 'var(--bg-tertiary)'};
          border: 1px solid ${isCurrent ? 'var(--bell-gold)' : 'var(--border-subtle)'};
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
        `;

        chip.innerHTML = `
          <span class="user-avatar-badge" style="width: 22px; height: 22px; font-size: 0.7rem; background-color: ${ringer.avatar_color || '#ffd700'};">
            ${(ringer.name || 'S').charAt(0).toUpperCase()}
          </span>
          <span style="font-size: 0.85rem; font-weight: ${isCurrent ? '700' : '500'}; color: ${isCurrent ? '#ffd700' : '#fff'};">
            ${ringer.name}
          </span>
          ${ringer.isAdmin ? '<span style="font-size: 0.65rem; background: rgba(255,215,0,0.2); color: #ffd700; padding: 1px 5px; border-radius: 4px;">Admin</span>' : ''}
          ${isCurrent ? '<span style="font-size: 0.75rem; color: #ffd700; font-weight: bold;">✓</span>' : ''}
        `;

        chip.addEventListener('click', async () => {
          if (isCurrent) return;
          await switchRinger(ringer);
        });

        dom.ringersChipsGrid.appendChild(chip);
      });
    } catch (err) {
      console.error('Erro ao listar sineiros:', err);
      dom.ringersChipsGrid.innerHTML = '<div style="color: var(--accent-red); font-size: 0.8rem;">Não foi possível carregar a lista de sineiros.</div>';
    }
  }

  async function switchRinger(ringer) {
    try {
      const res = await fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'switch_ringer',
          email: ringer.email
        })
      });
      const data = await res.json();
      if (data && data.success && data.user) {
        state.currentUser = data.user;
      } else {
        state.currentUser = ringer;
      }
    } catch (e) {
      state.currentUser = ringer;
    }

    localStorage.setItem('sinos_current_user_email', state.currentUser.email);
    updateUserUI();
    await refreshRingersList();
    if (dom.userModal) dom.userModal.classList.remove('open');

    setHudMessage(`Perfil alterado para ${state.currentUser.name}. Carregando seus sinos...`, 'ready');

    const scoreId = getCurrentScoreId();
    if (scoreId) {
      await loadSongAssignments(scoreId);
    }
  }

  function setupUserModal() {
    if (!dom.btnUserProfile || !dom.userModal) return;

    dom.btnUserProfile.addEventListener('click', () => {
      dom.userModal.classList.add('open');
      refreshRingersList();
    });

    if (dom.btnCloseUserModal) {
      dom.btnCloseUserModal.addEventListener('click', () => {
        dom.userModal.classList.remove('open');
      });
    }

    if (dom.btnCloseUserModalAction) {
      dom.btnCloseUserModalAction.addEventListener('click', () => {
        dom.userModal.classList.remove('open');
      });
    }

    dom.userModal.addEventListener('click', (e) => {
      if (e.target === dom.userModal) {
        dom.userModal.classList.remove('open');
      }
    });

    // Cadastro de novo sineiro
    if (dom.btnCreateRinger) {
      dom.btnCreateRinger.addEventListener('click', async () => {
        const name = (dom.newUserName ? dom.newUserName.value : '').trim();
        const email = (dom.newUserEmail ? dom.newUserEmail.value : '').trim().toLowerCase();

        if (!name || !email) {
          alert('Por favor, informe o nome e o e-mail do sineiro.');
          return;
        }

        if (!email.includes('@') || !email.includes('.')) {
          alert('Por favor, informe um e-mail válido.');
          return;
        }

        try {
          dom.btnCreateRinger.disabled = true;
          dom.btnCreateRinger.textContent = 'Cadastrando...';

          const res = await fetch('api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'register',
              name: name,
              email: email
            })
          });

          const data = await res.json();
          if (!data.success) {
            alert('Erro ao cadastrar: ' + (data.error || 'Erro desconhecido'));
            return;
          }

          if (dom.newUserName) dom.newUserName.value = '';
          if (dom.newUserEmail) dom.newUserEmail.value = '';

          state.currentUser = data.user;
          localStorage.setItem('sinos_current_user_email', data.user.email);
          updateUserUI();
          await refreshRingersList();
          dom.userModal.classList.remove('open');

          const scoreId = getCurrentScoreId();
          if (scoreId) {
            await loadSongAssignments(scoreId);
          }

          setHudMessage(`Sineiro "${data.user.name}" cadastrado e selecionado!`, 'ready');
        } catch (err) {
          console.error('Erro ao cadastrar sineiro:', err);
          alert('Erro de conexão ao cadastrar sineiro.');
        } finally {
          dom.btnCreateRinger.disabled = false;
          dom.btnCreateRinger.textContent = '+ Cadastrar Sineiro';
        }
      });
    }

    // Toggle do Login Admin
    if (dom.btnShowAdminLogin && dom.adminLoginFields) {
      dom.btnShowAdminLogin.addEventListener('click', () => {
        const isVisible = dom.adminLoginFields.style.display !== 'none';
        dom.adminLoginFields.style.display = isVisible ? 'none' : 'block';
        if (!isVisible && dom.adminPasswordInput) {
          dom.adminPasswordInput.focus();
        }
      });
    }

    // Login Admin
    if (dom.btnSubmitAdminLogin && dom.adminPasswordInput) {
      dom.btnSubmitAdminLogin.addEventListener('click', async () => {
        const password = dom.adminPasswordInput.value;
        if (!password) {
          alert('Digite a senha de administrador.');
          return;
        }

        try {
          dom.btnSubmitAdminLogin.disabled = true;
          const res = await fetch('api/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'login',
              email: 'flavioflavia@gmail.com',
              password: password
            })
          });

          const data = await res.json();
          if (!data.success) {
            alert('Acesso negado: ' + (data.error || 'Senha incorreta'));
            return;
          }

          state.currentUser = data.user;
          localStorage.setItem('sinos_current_user_email', data.user.email);
          updateUserUI();
          await refreshRingersList();
          dom.adminPasswordInput.value = '';
          dom.adminLoginFields.style.display = 'none';
          dom.userModal.classList.remove('open');

          const scoreId = getCurrentScoreId();
          if (scoreId) {
            await loadSongAssignments(scoreId);
          }

          setHudMessage('Bem-vindo, Administrador Flávio!', 'ready');
        } catch (err) {
          console.error('Erro no login admin:', err);
          alert('Erro ao validar acesso de administrador.');
        } finally {
          dom.btnSubmitAdminLogin.disabled = false;
        }
      });
    }
  }

  // ==========================================
  // CONVERSOR DE ARQUIVOS .MSF (MOBILESHEETS)
  // ==========================================

  function setupMsfModal() {
    if (!dom.btnOpenMsf || !dom.msfModal) return;

    dom.btnOpenMsf.addEventListener('click', () => {
      dom.msfModal.classList.add('open');
    });

    if (dom.btnCloseMsf) {
      dom.btnCloseMsf.addEventListener('click', () => {
        dom.msfModal.classList.remove('open');
      });
    }

    if (dom.btnCancelMsf) {
      dom.btnCancelMsf.addEventListener('click', () => {
        dom.msfModal.classList.remove('open');
      });
    }

    dom.msfModal.addEventListener('click', (e) => {
      if (e.target === dom.msfModal) {
        dom.msfModal.classList.remove('open');
      }
    });

    // Dropzone .msf
    if (dom.msfDropzone) {
      dom.msfDropzone.addEventListener('click', () => {
        if (dom.msfFileInput) dom.msfFileInput.click();
      });

      dom.msfDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.msfDropzone.classList.add('dragover');
      });

      dom.msfDropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dom.msfDropzone.classList.remove('dragover');
      });

      dom.msfDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.msfDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          openMsfModalWithFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (dom.msfFileInput) {
      dom.msfFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          openMsfModalWithFile(e.target.files[0]);
          dom.msfFileInput.value = '';
        }
      });
    }

    if (dom.btnSubmitMsf) {
      dom.btnSubmitMsf.addEventListener('click', () => {
        submitMsfConversion();
      });
    }
  }

  function openMsfModalWithFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'msf' && ext !== 'msb') {
      alert('Por favor, selecione um arquivo de partitura do MobileSheets (.msf ou .msb).');
      return;
    }

    state.msfSelectedFile = file;
    if (dom.msfModal) dom.msfModal.classList.add('open');

    if (dom.msfSelectedFileInfo && dom.msfSelectedFilename) {
      dom.msfSelectedFileInfo.style.display = 'block';
      dom.msfSelectedFilename.textContent = file.name;
    }

    if (dom.msfTitleInput) {
      const rawTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_\\-]+/g, ' ');
      dom.msfTitleInput.value = rawTitle;
    }

    if (dom.btnSubmitMsf) {
      dom.btnSubmitMsf.disabled = false;
    }
  }

  async function submitMsfConversion() {
    if (!state.msfSelectedFile) {
      alert('Nenhum arquivo .msf selecionado.');
      return;
    }

    const file = state.msfSelectedFile;
    const title = (dom.msfTitleInput ? dom.msfTitleInput.value.trim() : '') || file.name.replace(/\.[^/.]+$/, '');

    dom.msfStatus.style.display = 'flex';
    dom.msfStatusText.textContent = `Enviando "${file.name}" para o conversor de MobileSheets...`;
    dom.btnSubmitMsf.disabled = true;
    if (dom.btnCancelMsf) dom.btnCancelMsf.disabled = true;

    const formData = new FormData();
    formData.append('msf_file', file);
    formData.append('title', title);
    formData.append('user_name', state.currentUser ? state.currentUser.name : 'Sineiro');
    formData.append('user_email', state.currentUser ? state.currentUser.email : '');

    try {
      const resp = await fetch('api/convert_msf.php', {
        method: 'POST',
        headers: {
          'X-User-Email': state.currentUser ? state.currentUser.email : ''
        },
        body: formData
      });

      const rawText = await resp.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error('Resposta inválida do servidor: ' + (rawText.substring(0, 80) || ''));
      }

      if (!data.success || !data.jobId) {
        throw new Error(data.error || 'Falha ao iniciar conversão do arquivo .msf.');
      }

      const jobId = data.jobId;
      dom.msfStatusText.textContent = 'Descompactando .msf e transcrevendo partitura com Google Gemini...';

      // Polling a cada 2.5s
      let completed = false;
      const startTime = Date.now();
      const maxTimeoutMs = 10 * 60 * 1000;

      while (!completed) {
        if (Date.now() - startTime > maxTimeoutMs) {
          throw new Error('Tempo limite excedido na conversão do arquivo .msf.');
        }

        await new Promise(r => setTimeout(r, 2500));

        let statusResp;
        try {
          statusResp = await fetch(`api/transcribe_status.php?jobId=${encodeURIComponent(jobId)}&t=${Date.now()}`);
        } catch (e) {
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

        if (job.status === 'processing' || job.status === 'analyzing' || job.status === 'transcribing' || job.status === 'converting') {
          const pct = job.percent !== undefined ? ` (${job.percent}%)` : '';
          dom.msfStatusText.textContent = (job.message || 'Convertendo partitura...') + pct;
        } else if (job.status === 'completed') {
          completed = true;
          dom.msfStatusText.textContent = 'Partitura MusicXML gerada com sucesso! Carregando no estúdio de sinos...';
          
          const finalFilename = job.output || job.outputFilename || data.outputFilename;
          const scoreUrl = finalFilename.startsWith('scores/') ? finalFilename : ('scores/' + finalFilename);
          const scoreTitle = job.title || title;

          await loadServerScoresList();
          addNewOptionToSelect(scoreTitle, scoreUrl);
          state.currentScoreUrl = scoreUrl;
          savePreferences();
          await loadScore(scoreUrl);

          setTimeout(() => {
            dom.msfModal.classList.remove('open');
            dom.msfStatus.style.display = 'none';
            dom.btnSubmitMsf.disabled = false;
            if (dom.btnCancelMsf) dom.btnCancelMsf.disabled = false;
            state.msfSelectedFile = null;
            if (dom.msfSelectedFileInfo) dom.msfSelectedFileInfo.style.display = 'none';
            if (dom.msfTitleInput) dom.msfTitleInput.value = '';
            setHudMessage(`Música "${scoreTitle}" convertida de .msf e salva no acervo!`, 'ready');
          }, 1200);
          return;
        } else if (job.status === 'error') {
          completed = true;
          throw new Error(job.message || job.error || 'Erro na conversão do arquivo .msf.');
        }
      }
    } catch (err) {
      console.error('Erro na conversão .msf:', err);
      dom.msfStatusText.textContent = `Erro: ${err.message}`;
      dom.btnSubmitMsf.disabled = false;
      if (dom.btnCancelMsf) dom.btnCancelMsf.disabled = false;
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

    // Grava também as notas atribuídas para esta música no servidor
    scheduleSaveSongAssignment();
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
