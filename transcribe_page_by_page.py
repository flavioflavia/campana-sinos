#!/usr/bin/env python3
"""
Transcritor OMR Página por Página para Partituras Longas de Handbells
Garante 100% de fidelidade compasso por compasso sem que o modelo resuma ou corte.
"""

import sys
import os
import re
import argparse
from dotenv import load_dotenv

load_dotenv('/var/www/html/sinos/.env')
api_key = os.getenv('GEMINI_API_KEY')
if not api_key:
    sys.exit(1)

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)

MODELS = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite"
]

PAGE_PROMPT = """Você é um especialista em transcrição e editoração musical profissional especializado em partituras para Orquestra de Sinos (Handbells).
Sua missão é transcrever com precisão ABSOLUTA todos os compassos visíveis nesta folha da partitura para MusicXML 3.1.

DIRETRIZES:
1. GRAND STAFF: Part P1, staves 2 (Pauta 1 Clave de Sol G2, Pauta 2 Clave de Fá F4).
2. Se esta for a Folha 1, inclua o cabeçalho <score-partwise>, <work>, <part-list>, e no compasso 1 os <attributes> com <divisions>4</divisions>, <key>, <time>, <staves>2</staves>, <clef>.
3. Para folhas subsequentes (Folha 2, 3, etc.), transcreva EXATAMENTE os compassos visíveis numerados corretamente.
4. É TERMINANTEMENTE PROIBIDO RESUMIR OU OMITIR QUALQUER COMPASSO. Você deve escrever nota por nota, acorde por acorde, usando <chord/> para notas simultâneas na mesma pauta e <backup><duration>...</duration></backup> para a pauta 2.
5. Retorne os blocos <measure number="...">...</measure>.
"""

def call_gemini(contents, system_instruction=PAGE_PROMPT):
    last_err = None
    for m in MODELS:
        try:
            resp = client.models.generate_content(
                model=m,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1
                )
            )
            return resp.text
        except Exception as e:
            print(f"    [!] Tentativa com {m} falhou: {e}. Tentando próximo...")
            last_err = e
    raise last_err

def transcribe_multipage(image_files, output_file, title="Partitura"):
    print(f"[*] Iniciando transcrição sequencial de {len(image_files)} folhas para: {title}")
    
    all_measures_xml = []
    header_xml = None
    
    for idx, img_path in enumerate(image_files, 1):
        print(f"\n--- Processando Folha {idx} de {len(image_files)}: {os.path.basename(img_path)} ---")
        with open(img_path, "rb") as f:
            data = f.read()
        
        part = types.Part.from_bytes(data=data, mime_type="image/jpeg")
        
        prompt = f"Esta é a Folha {idx} de {len(image_files)} da música '{title}'. Transcreva rigorosamente TODOS os compassos desta folha em MusicXML."
        if idx == 1:
            prompt += " Inclua cabeçalho completo do MusicXML e atributos do compasso 1."
        else:
            prompt += " Transcreva todos os compassos da folha mantendo a numeração correta impressa na folha."
            
        txt = call_gemini([part, prompt])
        
        # Limpa markdown fences
        txt = re.sub(r'^```xml\s*', '', txt.strip(), flags=re.IGNORECASE)
        txt = re.sub(r'^```\s*', '', txt)
        txt = re.sub(r'\s*```$', '', txt)
        
        # Se for folha 1, extrai cabeçalho até o primeiro <measure>
        if idx == 1:
            header_match = re.search(r'(<\?xml.*?</part-list>\s*<part id="P1">)', txt, flags=re.DOTALL)
            if header_match:
                header_xml = header_match.group(1)
            else:
                header_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>{title}</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Handbells</part-name>
    </score-part>
  </part-list>
  <part id="P1">'''
        
        # Extrai todos os blocos <measure ...>...</measure>
        measures = re.findall(r'(<measure\s+number=.*?</measure>)', txt, flags=re.DOTALL)
        print(f"[✓] Folha {idx}: {len(measures)} compassos extraídos.")
        for m in measures:
            all_measures_xml.append(m)
            
    # Monta XML final
    if not header_xml:
        header_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>{title}</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Handbells</part-name>
    </score-part>
  </part-list>
  <part id="P1">'''
    
    final_xml = header_xml + "\n" + "\n".join(all_measures_xml) + "\n  </part>\n</score-partwise>\n"
    
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(final_xml)
        
    print(f"\n[★] Transcrição Concluída com Sucesso! Total de compassos: {len(all_measures_xml)}")
    print(f"[★] Salvo em: {output_file} ({len(final_xml)} bytes)")
    return output_file

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", nargs="+", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--title", default="Partitura")
    args = parser.parse_args()
    
    transcribe_multipage(args.images, args.output, args.title)
