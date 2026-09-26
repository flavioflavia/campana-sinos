#!/usr/bin/env python3
"""
OMR Engine - Optical Music Recognition via Google Gemini Vision
Converte fotos/escaneamentos de partituras (páginas individuais ou múltiplas)
em arquivos MusicXML 3.1 válidos para o aplicativo Campana.
Suporta acompanhamento de status em tempo real via arquivo de job JSON.
"""

import sys
import os
import re
import time
import json
import argparse
import xml.etree.ElementTree as ET
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv('/var/www/html/sinos/.env')
if not os.getenv('GEMINI_API_KEY'):
    load_dotenv('/var/www/html/aprendizado/backend/.env')

api_key = os.getenv('GEMINI_API_KEY')
if not api_key:
    sys.stderr.write("ERRO: GEMINI_API_KEY não encontrada.\n")
    sys.exit(1)

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)

PAGE_SYSTEM_PROMPT = """Você é um especialista em transcrição e editoração musical profissional especializado em partituras para Orquestra de Sinos (Handbells).
Sua missão é transcrever com precisão ABSOLUTA todos os compassos visíveis nesta folha da partitura para MusicXML 3.1.

DIRETRIZES TÉCNICAS:
1. ESTRUTURA GRAND STAFF:
   - Part P1 com 2 pautas: Pauta 1 Clave de Sol (G2), Pauta 2 Clave de Fá (F4).
2. CABEÇALHO E ATRIBUTOS:
   - Se for a Folha 1, inclua <score-partwise>, <work>, <part-list> e no primeiro compasso os <attributes> (<divisions>4</divisions>, <key>, <time>, <staves>2</staves>, <clef>).
   - Se for folha subsequente (Folha 2, 3, etc.), transcreva todos os compassos respeitando a numeração original contínua.
3. POLIFONIA E ACORDES:
   - Use <chord/> para notas simultâneas na mesma pauta.
   - Use <backup><duration>...</duration></backup> para retornar ao início do compasso para a Pauta 2.
4. PADRÃO MUSICXML PARA NOTAS:
   - O elemento <step> DEVE conter APENAS a letra maiúscula pura (A, B, C, D, E, F, G).
   - NUNCA coloque acidentes (# ou b) dentro de <step>.
   - Para sustenido, use <step>F</step><alter>1</alter>. Para bemol, use <step>B</step><alter>-1</alter>.
5. RIGOR:
   - É TERMINANTEMENTE PROIBIDO RESUMIR OU OMITIR QUALQUER COMPASSO. Não use comentários do tipo 'continue generating'. Escreva todos os compassos e notas.
   - Retorne apenas os blocos XML bem-formados.
"""

MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview"
]

def update_job_status(job_file, status, message, percent=0, extra=None):
    if not job_file:
        return
    try:
        data = {
            "status": status,
            "message": message,
            "percent": int(percent),
            "updated_at": time.time()
        }
        if extra and isinstance(extra, dict):
            data.update(extra)
        
        tmp = job_file + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, job_file)
    except Exception as e:
        print(f"[!] Falha ao gravar status do job: {e}")

def call_gemini_vision(contents, system_instruction=PAGE_SYSTEM_PROMPT):
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
            print(f"[!] Modelo {m} falhou: {e}. Tentando próximo modelo...")
            last_err = e
    raise last_err

def repair_and_validate_xml(xml_str):
    # Normaliza acidentes indevidamente inseridos dentro de <step> (ex: <step>F#</step> -> <step>F</step><alter>1</alter>)
    xml_str = re.sub(r'<step>\s*([A-Ga-g])#\s*</[^>]+>', r'<step>\1</step><alter>1</alter>', xml_str)
    xml_str = re.sub(r'<step>\s*([A-Ga-g])b\s*</[^>]+>', r'<step>\1</step><alter>-1</alter>', xml_str)
    xml_str = re.sub(r'<step>\s*([a-g])\s*</[^>]+>', lambda m: f'<step>{m.group(1).upper()}</step>', xml_str)
    xml_str = re.sub(r'<step>\s*([A-G])\s*</[^>]+>', r'<step>\1</step>', xml_str)

    # Corrige tags comuns que modelos de IA podem fechar com nome truncado
    xml_str = re.sub(r'<octave>(\d+)</[^>]+>', r'<octave>\1</octave>', xml_str)
    xml_str = re.sub(r'<duration>(\d+)</[^>]+>', r'<duration>\1</duration>', xml_str)
    xml_str = re.sub(r'<type>([a-z]+)</[^>]+>', r'<type>\1</type>', xml_str)
    xml_str = re.sub(r'<voice>(\d+)</[^>]+>', r'<voice>\1</voice>', xml_str)
    xml_str = re.sub(r'<staff>(\d+)</[^>]+>', r'<staff>\1</staff>', xml_str)
    xml_str = re.sub(r'<fifths>(-?\d+)</[^>]+>', r'<fifths>\1</fifths>', xml_str)
    xml_str = re.sub(r'<beats>(\d+)</[^>]+>', r'<beats>\1</beats>', xml_str)
    xml_str = re.sub(r'<beat-type>(\d+)</[^>]+>', r'<beat-type>\1</beat-type>', xml_str)
    xml_str = xml_str.replace('&nbsp;', ' ')

    try:
        ET.fromstring(xml_str)
        print("[✓] XML validado com sucesso pelo parser de sintaxe.")
    except ET.ParseError as pe:
        print(f"[!] Aviso de sintaxe no XML: {pe}. Aplicando garantia de fechamento...")
        if '</part>' not in xml_str:
            xml_str += '\n  </part>'
        if '</score-partwise>' not in xml_str:
            xml_str += '\n</score-partwise>\n'
    return xml_str

def transcribe_images(image_paths, output_file=None, custom_title=None, job_file=None):
    total = len(image_paths)
    print(f"[*] Iniciando transcrição OMR de {total} folha(s)...")
    update_job_status(job_file, "processing", f"Iniciando análise de {total} folha(s)...", 5, {"totalPages": total})
    
    title = custom_title or "Partitura de Sinos"
    all_measures_xml = []
    header_xml = None

    for idx, path in enumerate(image_paths, 1):
        if not os.path.isfile(path):
            raise FileNotFoundError(f"Arquivo não encontrado: {path}")
        
        ext = os.path.splitext(path)[1].lower()
        mime_type = "image/png" if ext == ".png" else "image/jpeg"
        
        current_percent = int(5 + ((idx - 1) / total) * 75)
        update_job_status(
            job_file,
            "processing",
            f"Analisando folha {idx} de {total} com Google Gemini Vision...",
            current_percent,
            {"currentPage": idx, "totalPages": total}
        )
        
        with open(path, "rb") as f:
            data = f.read()
            
        part = types.Part.from_bytes(data=data, mime_type=mime_type)
        print(f"    -> Processando folha {idx}/{total}: {os.path.basename(path)}")
        
        prompt = f"Esta é a Folha {idx} de {total} da partitura de sinos '{title}'. Transcreva rigorosamente todos os compassos presentes."
        if idx == 1:
            prompt += " Inclua cabeçalho completo do MusicXML e atributos do compasso 1."
        else:
            prompt += " Transcreva os compassos mantendo a numeração original contínua."
            
        txt = call_gemini_vision([part, prompt])
        
        txt = re.sub(r'^```xml\s*', '', txt.strip(), flags=re.IGNORECASE)
        txt = re.sub(r'^```\s*', '', txt)
        txt = re.sub(r'\s*```$', '', txt)
        
        if idx == 1:
            title_match = re.search(r'<work-title>(.*?)</work-title>', txt)
            if title_match and not custom_title:
                title = title_match.group(1).strip()
            
            header_match = re.search(r'(<\?xml.*?</part-list>\s*<part id="P1">)', txt, flags=re.DOTALL)
            if header_match:
                header_xml = header_match.group(1)
                
        measures = re.findall(r'(<measure\s+number=.*?</measure>)', txt, flags=re.DOTALL)
        print(f"    [✓] Folha {idx}: {len(measures)} compassos extraídos.")
        
        # Insere quebra de página explícita na mudança de folha física
        if idx > 1 and len(measures) > 0:
            first_m = measures[0]
            if '<print' not in first_m:
                first_m = re.sub(
                    r'(<measure\s+number=\"?\d+\"?[^>]*>)',
                    r'\1\n      <print new-page="yes"/>',
                    first_m,
                    count=1
                )
                measures[0] = first_m

        for m in measures:
            all_measures_xml.append(m)

    update_job_status(job_file, "processing", "Montando e validando estrutura da partitura...", 85)

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
    final_xml = repair_and_validate_xml(final_xml)
    
    if output_file:
        os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(final_xml)
        print(f"[★] Partitura salva: {output_file} (Total: {len(all_measures_xml)} compassos, {len(final_xml)} bytes)")
        
    score_rel_url = 'scores/' + os.path.basename(output_file) if output_file else None
    update_job_status(
        job_file,
        "completed",
        "Partitura transcrita com sucesso!",
        100,
        {
            "scoreUrl": score_rel_url,
            "filename": os.path.basename(output_file) if output_file else "",
            "title": title,
            "measures": len(all_measures_xml),
            "fileSize": len(final_xml)
        }
    )
        
    return final_xml

def main():
    parser = argparse.ArgumentParser(description="OMR de Partituras para Handbells via Gemini Vision")
    parser.add_argument("--images", nargs="+", required=True, help="Caminhos das imagens das folhas em ordem")
    parser.add_argument("--output", required=False, help="Arquivo .musicxml de saída")
    parser.add_argument("--title", required=False, help="Título opcional da música")
    parser.add_argument("--job-file", required=False, help="Arquivo JSON de acompanhamento de status do job")
    args = parser.parse_args()

    try:
        xml = transcribe_images(args.images, args.output, args.title, args.job_file)
        if not args.output:
            print(xml)
    except Exception as e:
        sys.stderr.write(f"\n[ERRO NA TRANSCRIÇÃO]: {e}\n")
        if args.job_file:
            update_job_status(args.job_file, "error", f"Erro na transcrição: {str(e)}", 0)
        sys.exit(1)

if __name__ == "__main__":
    main()
