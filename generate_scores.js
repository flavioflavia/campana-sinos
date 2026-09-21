const fs = require('fs');
const path = require('path');

function createMusicXML({ title, composer, tempo = 100, timeBeats = 4, timeBeatType = 4, measures }) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${title}</work-title>
  </work>
  <identification>
    <creator type="composer">${composer}</creator>
    <creator type="arranger">Arranjo para Orquestra de Sinos</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Handbells</part-name>
      <part-abbreviation>Hb.</part-abbreviation>
      <score-instrument id="P1-I1">
        <instrument-name>English Handbells</instrument-name>
      </score-instrument>
      <midi-instrument id="P1-I1">
        <midi-channel>1</midi-channel>
        <midi-program>15</midi-program>
      </midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
`;

  measures.forEach((m, mIdx) => {
    const mNum = mIdx + 1;
    xml += `    <measure number="${mNum}">\n`;
    if (mIdx === 0) {
      xml += `      <attributes>
        <divisions>4</divisions>
        <key>
          <fifths>${m.keyFifths || 0}</fifths>
        </key>
        <time>
          <beats>${timeBeats}</beats>
          <beat-type>${timeBeatType}</beat-type>
        </time>
        <staves>2</staves>
        <clef number="1">
          <sign>G</sign>
          <line>2</line>
        </clef>
        <clef number="2">
          <sign>F</sign>
          <line>4</line>
        </clef>
      </attributes>
      <direction placement="above">
        <direction-type>
          <metronome>
            <beat-unit>quarter</beat-unit>
            <per-minute>${tempo}</per-minute>
          </metronome>
        </direction-type>
        <sound tempo="${tempo}"/>
      </direction>\n`;
    }

    // Pauta 1 (Agudos - Clave de Sol)
    if (m.stave1) {
      m.stave1.forEach(note => {
        xml += formatNoteXML(note, 1);
      });
    }

    // Transição de voz / pauta usando backup se necessário
    if (m.stave2 && m.stave2.length > 0) {
      const totalDivs = m.stave1Divs || (timeBeats * 4);
      xml += `      <backup>\n        <duration>${totalDivs}</duration>\n      </backup>\n`;
      m.stave2.forEach(note => {
        xml += formatNoteXML(note, 2);
      });
    }

    xml += `    </measure>\n`;
  });

  xml += `  </part>\n</score-partwise>\n`;
  return xml;
}

function formatNoteXML(n, staff) {
  let res = `      <note>\n`;
  if (n.rest) {
    res += `        <rest/>\n`;
  } else {
    res += `        <pitch>\n`;
    res += `          <step>${n.step}</step>\n`;
    if (n.alter) res += `          <alter>${n.alter}</alter>\n`;
    res += `          <octave>${n.octave}</octave>\n`;
    res += `        </pitch>\n`;
  }
  res += `        <duration>${n.duration}</duration>\n`;
  res += `        <voice>${staff === 1 ? 1 : 2}</voice>\n`;
  res += `        <type>${n.type}</type>\n`;
  if (n.dot) res += `        <dot/>\n`;
  res += `        <staff>${staff}</staff>\n`;
  res += `      </note>\n`;
  return res;
}

// 1. Hino à Alegria (Ode to Joy) - Beethoven
// Sinos: C4, D4, E4, F4, G4, A4, B4, C5 (melodia e harmonia)
const odeToJoyMeasures = [
  // M1: E4 E4 F4 G4 / C4(mínima) G3(mínima)
  {
    stave1: [
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 8, type: 'half' },
      { step: 'G', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M2: G4 F4 E4 D4 / E3(mínima) B2(mínima)
  {
    stave1: [
      { step: 'G', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'E', octave: 3, duration: 8, type: 'half' },
      { step: 'B', octave: 2, duration: 8, type: 'half' }
    ]
  },
  // M3: C4 C4 D4 E4 / A2(mínima) G2(mínima)
  {
    stave1: [
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'A', octave: 2, duration: 8, type: 'half' },
      { step: 'G', octave: 2, duration: 8, type: 'half' }
    ]
  },
  // M4: E4. D4(colcheia) D4(mínima) / C3(semibreve)
  {
    stave1: [
      { step: 'E', octave: 4, duration: 6, type: 'quarter', dot: true },
      { step: 'D', octave: 4, duration: 2, type: 'eighth' },
      { step: 'D', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'G', octave: 3, duration: 8, type: 'half' },
      { step: 'F', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M5: E4 E4 F4 G4 / C3(mínima) G3(mínima)
  {
    stave1: [
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 8, type: 'half' },
      { step: 'G', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M6: G4 F4 E4 D4 / E3(mínima) B2(mínima)
  {
    stave1: [
      { step: 'G', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'E', octave: 3, duration: 8, type: 'half' },
      { step: 'B', octave: 2, duration: 8, type: 'half' }
    ]
  },
  // M7: C4 C4 D4 E4 / A2(mínima) F3(mínima)
  {
    stave1: [
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'A', octave: 2, duration: 8, type: 'half' },
      { step: 'F', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M8: D4. C4(colcheia) C4(mínima) / G3(mínima) C3(mínima)
  {
    stave1: [
      { step: 'D', octave: 4, duration: 6, type: 'quarter', dot: true },
      { step: 'C', octave: 4, duration: 2, type: 'eighth' },
      { step: 'C', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'G', octave: 2, duration: 8, type: 'half' },
      { step: 'C', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M9: D4 D4 E4 C4 / B2(mínima) C3(mínima)
  {
    stave1: [
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'C', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'B', octave: 2, duration: 8, type: 'half' },
      { step: 'C', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M10: D4 E4(c) F4(c) E4 C4 / G2(mínima) A2(mínima)
  {
    stave1: [
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 2, type: 'eighth' },
      { step: 'F', octave: 4, duration: 2, type: 'eighth' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'C', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'G', octave: 2, duration: 8, type: 'half' },
      { step: 'A', octave: 2, duration: 8, type: 'half' }
    ]
  },
  // M11: D4 E4(c) F4(c) E4 D4 / B2(mínima) G2(mínima)
  {
    stave1: [
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 2, type: 'eighth' },
      { step: 'F', octave: 4, duration: 2, type: 'eighth' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'B', octave: 2, duration: 8, type: 'half' },
      { step: 'G', octave: 2, duration: 8, type: 'half' }
    ]
  },
  // M12: C4 D4 G3 E4 / A2(mínima) E3(mínima)
  {
    stave1: [
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 3, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'A', octave: 2, duration: 8, type: 'half' },
      { step: 'E', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M13: E4 E4 F4 G4 / C3(mínima) G3(mínima)
  {
    stave1: [
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 8, type: 'half' },
      { step: 'G', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M14: G4 F4 E4 D4 / E3(mínima) B2(mínima)
  {
    stave1: [
      { step: 'G', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'E', octave: 3, duration: 8, type: 'half' },
      { step: 'B', octave: 2, duration: 8, type: 'half' }
    ]
  },
  // M15: C4 C4 D4 E4 / A2(mínima) F3(mínima)
  {
    stave1: [
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'A', octave: 2, duration: 8, type: 'half' },
      { step: 'F', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M16: D4. C4(colcheia) C4(mínima) / G2(mínima) C3(mínima)
  {
    stave1: [
      { step: 'D', octave: 4, duration: 6, type: 'quarter', dot: true },
      { step: 'C', octave: 4, duration: 2, type: 'eighth' },
      { step: 'C', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'G', octave: 2, duration: 8, type: 'half' },
      { step: 'C', octave: 3, duration: 8, type: 'half' }
    ]
  }
];

// 2. Noite Feliz (Silent Night) - 3/4, 80 BPM
const silentNightMeasures = [
  // M1: G4(pontuada), A4(colcheia), G4(semínima) / C3(semínima pontuada em semínima)...
  {
    stave1: [
      { step: 'G', octave: 4, duration: 6, type: 'quarter', dot: true },
      { step: 'A', octave: 4, duration: 2, type: 'eighth' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M2: E4(mínima pontuada) / E3(mínima pontuada)
  {
    stave1: [
      { step: 'E', octave: 4, duration: 12, type: 'half', dot: true }
    ],
    stave2: [
      { step: 'G', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M3: G4(pontuada), A4(colcheia), G4(semínima)
  {
    stave1: [
      { step: 'G', octave: 4, duration: 6, type: 'quarter', dot: true },
      { step: 'A', octave: 4, duration: 2, type: 'eighth' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M4: E4(mínima pontuada)
  {
    stave1: [
      { step: 'E', octave: 4, duration: 12, type: 'half', dot: true }
    ],
    stave2: [
      { step: 'G', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M5: D5(mínima), D5(semínima) / G2(mínima pontuada)
  {
    stave1: [
      { step: 'D', octave: 5, duration: 8, type: 'half' },
      { step: 'D', octave: 5, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'B', octave: 2, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M6: B4(mínima pontuada) / G3(mínima pontuada)
  {
    stave1: [
      { step: 'B', octave: 4, duration: 12, type: 'half', dot: true }
    ],
    stave2: [
      { step: 'G', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M7: C5(mínima), C5(semínima) / C3(mínima pontuada)
  {
    stave1: [
      { step: 'C', octave: 5, duration: 8, type: 'half' },
      { step: 'C', octave: 5, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M8: G4(mínima pontuada) / E3(mínima pontuada)
  {
    stave1: [
      { step: 'G', octave: 4, duration: 12, type: 'half', dot: true }
    ],
    stave2: [
      { step: 'E', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M9: A4(mínima), A4(semínima) / F3(mínima pontuada)
  {
    stave1: [
      { step: 'A', octave: 4, duration: 8, type: 'half' },
      { step: 'A', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'F', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M10: C5(pontuada), B4(colcheia), A4(semínima) / F3(mínima pontuada)
  {
    stave1: [
      { step: 'C', octave: 5, duration: 6, type: 'quarter', dot: true },
      { step: 'B', octave: 4, duration: 2, type: 'eighth' },
      { step: 'A', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'F', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M11: G4(pontuada), A4(colcheia), G4(semínima) / E3(mínima pontuada)
  {
    stave1: [
      { step: 'G', octave: 4, duration: 6, type: 'quarter', dot: true },
      { step: 'A', octave: 4, duration: 2, type: 'eighth' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  },
  // M12: E4(mínima pontuada) / C3(mínima pontuada)
  {
    stave1: [
      { step: 'E', octave: 4, duration: 12, type: 'half', dot: true }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 12, type: 'half', dot: true }
    ],
    stave1Divs: 12
  }
];

// 3. Canon em Ré (Pachelbel) - 4/4, 72 BPM (Transposto para C maior para sinos C4-C6)
const canonMeasures = [
  // M1: Baixo entra sozinho: C4, G3, A3, E3
  {
    stave1: [
      { step: 'E', octave: 5, duration: 8, type: 'half' },
      { step: 'D', octave: 5, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 4, type: 'quarter' },
      { step: 'G', octave: 3, duration: 4, type: 'quarter' },
      { step: 'A', octave: 3, duration: 4, type: 'quarter' },
      { step: 'E', octave: 3, duration: 4, type: 'quarter' }
    ]
  },
  // M2: C5, B4, A4, G4 / F3, C3, F3, G3
  {
    stave1: [
      { step: 'C', octave: 5, duration: 8, type: 'half' },
      { step: 'B', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'F', octave: 3, duration: 4, type: 'quarter' },
      { step: 'C', octave: 3, duration: 4, type: 'quarter' },
      { step: 'F', octave: 3, duration: 4, type: 'quarter' },
      { step: 'G', octave: 3, duration: 4, type: 'quarter' }
    ]
  },
  // M3: A4, G4, F4, E4 / C3, G3, A3, E3
  {
    stave1: [
      { step: 'A', octave: 4, duration: 8, type: 'half' },
      { step: 'G', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 4, type: 'quarter' },
      { step: 'G', octave: 3, duration: 4, type: 'quarter' },
      { step: 'A', octave: 3, duration: 4, type: 'quarter' },
      { step: 'E', octave: 3, duration: 4, type: 'quarter' }
    ]
  },
  // M4: F4, E4, D4, C4 / F3, C3, F3, G3
  {
    stave1: [
      { step: 'F', octave: 4, duration: 8, type: 'half' },
      { step: 'E', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'F', octave: 3, duration: 4, type: 'quarter' },
      { step: 'C', octave: 3, duration: 4, type: 'quarter' },
      { step: 'F', octave: 3, duration: 4, type: 'quarter' },
      { step: 'G', octave: 3, duration: 4, type: 'quarter' }
    ]
  },
  // M5: Movimento melódico rápido em colcheias
  {
    stave1: [
      { step: 'C', octave: 5, duration: 2, type: 'eighth' },
      { step: 'B', octave: 4, duration: 2, type: 'eighth' },
      { step: 'C', octave: 5, duration: 2, type: 'eighth' },
      { step: 'D', octave: 5, duration: 2, type: 'eighth' },
      { step: 'E', octave: 5, duration: 2, type: 'eighth' },
      { step: 'D', octave: 5, duration: 2, type: 'eighth' },
      { step: 'C', octave: 5, duration: 2, type: 'eighth' },
      { step: 'B', octave: 4, duration: 2, type: 'eighth' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 4, type: 'quarter' },
      { step: 'G', octave: 3, duration: 4, type: 'quarter' },
      { step: 'A', octave: 3, duration: 4, type: 'quarter' },
      { step: 'E', octave: 3, duration: 4, type: 'quarter' }
    ]
  },
  // M6:
  {
    stave1: [
      { step: 'A', octave: 4, duration: 2, type: 'eighth' },
      { step: 'G', octave: 4, duration: 2, type: 'eighth' },
      { step: 'A', octave: 4, duration: 2, type: 'eighth' },
      { step: 'B', octave: 4, duration: 2, type: 'eighth' },
      { step: 'C', octave: 5, duration: 2, type: 'eighth' },
      { step: 'B', octave: 4, duration: 2, type: 'eighth' },
      { step: 'A', octave: 4, duration: 2, type: 'eighth' },
      { step: 'G', octave: 4, duration: 2, type: 'eighth' }
    ],
    stave2: [
      { step: 'F', octave: 3, duration: 4, type: 'quarter' },
      { step: 'C', octave: 3, duration: 4, type: 'quarter' },
      { step: 'F', octave: 3, duration: 4, type: 'quarter' },
      { step: 'G', octave: 3, duration: 4, type: 'quarter' }
    ]
  },
  // M7: Final C5 semibreve
  {
    stave1: [
      { step: 'C', octave: 5, duration: 16, type: 'whole' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 16, type: 'whole' }
    ]
  }
];

// 4. Brilha Brilha Estrelinha (Twinkle Twinkle) - Ideal para iniciantes
const twinkleMeasures = [
  // M1: C4 C4 G4 G4 / C3(mínima) E3(mínima)
  {
    stave1: [
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 8, type: 'half' },
      { step: 'E', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M2: A4 A4 G4(mínima) / F3(mínima) C3(mínima)
  {
    stave1: [
      { step: 'A', octave: 4, duration: 4, type: 'quarter' },
      { step: 'A', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'F', octave: 3, duration: 8, type: 'half' },
      { step: 'C', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M3: F4 F4 E4 E4 / D3(mínima) C3(mínima)
  {
    stave1: [
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'D', octave: 3, duration: 8, type: 'half' },
      { step: 'C', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M4: D4 D4 C4(mínima) / G2(mínima) C3(mínima)
  {
    stave1: [
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'C', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'G', octave: 2, duration: 8, type: 'half' },
      { step: 'C', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M5: G4 G4 F4 F4 / E3(mínima) D3(mínima)
  {
    stave1: [
      { step: 'G', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'E', octave: 3, duration: 8, type: 'half' },
      { step: 'D', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M6: E4 E4 D4(mínima) / C3(mínima) G2(mínima)
  {
    stave1: [
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 8, type: 'half' },
      { step: 'G', octave: 2, duration: 8, type: 'half' }
    ]
  },
  // M7: C4 C4 G4 G4 / C3(mínima) E3(mínima)
  {
    stave1: [
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'C', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'C', octave: 3, duration: 8, type: 'half' },
      { step: 'E', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M8: A4 A4 G4(mínima) / F3(mínima) C3(mínima)
  {
    stave1: [
      { step: 'A', octave: 4, duration: 4, type: 'quarter' },
      { step: 'A', octave: 4, duration: 4, type: 'quarter' },
      { step: 'G', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'F', octave: 3, duration: 8, type: 'half' },
      { step: 'C', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M9: F4 F4 E4 E4 / D3(mínima) C3(mínima)
  {
    stave1: [
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'F', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' },
      { step: 'E', octave: 4, duration: 4, type: 'quarter' }
    ],
    stave2: [
      { step: 'D', octave: 3, duration: 8, type: 'half' },
      { step: 'C', octave: 3, duration: 8, type: 'half' }
    ]
  },
  // M10: D4 D4 C4(mínima) / G2(mínima) C3(mínima)
  {
    stave1: [
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'D', octave: 4, duration: 4, type: 'quarter' },
      { step: 'C', octave: 4, duration: 8, type: 'half' }
    ],
    stave2: [
      { step: 'G', octave: 2, duration: 8, type: 'half' },
      { step: 'C', octave: 3, duration: 8, type: 'half' }
    ]
  }
];

// Salvar os arquivos
const scoresDir = path.join(__dirname, 'scores');
if (!fs.existsSync(scoresDir)) fs.mkdirSync(scoresDir, { recursive: true });

fs.writeFileSync(
  path.join(scoresDir, 'hino-da-alegria.musicxml'),
  createMusicXML({
    title: 'Hino à Alegria (Ode to Joy)',
    composer: 'Ludwig van Beethoven',
    tempo: 104,
    timeBeats: 4,
    timeBeatType: 4,
    measures: odeToJoyMeasures
  }),
  'utf8'
);

fs.writeFileSync(
  path.join(scoresDir, 'noite-feliz.musicxml'),
  createMusicXML({
    title: 'Noite Feliz (Silent Night)',
    composer: 'Franz Xaver Gruber',
    tempo: 84,
    timeBeats: 3,
    timeBeatType: 4,
    measures: silentNightMeasures
  }),
  'utf8'
);

fs.writeFileSync(
  path.join(scoresDir, 'canon-em-re.musicxml'),
  createMusicXML({
    title: 'Canon em Ré (Arranjo em Dó para Sinos)',
    composer: 'Johann Pachelbel',
    tempo: 76,
    timeBeats: 4,
    timeBeatType: 4,
    measures: canonMeasures
  }),
  'utf8'
);

fs.writeFileSync(
  path.join(scoresDir, 'brilha-brilha-estrelinha.musicxml'),
  createMusicXML({
    title: 'Brilha Brilha Estrelinha (Para Iniciantes)',
    composer: 'Melodia Tradicional',
    tempo: 96,
    timeBeats: 4,
    timeBeatType: 4,
    measures: twinkleMeasures
  }),
  'utf8'
);

console.log('Partituras MusicXML geradas com sucesso!');
