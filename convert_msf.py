#!/usr/bin/env python3
"""
MSF Converter - Converte arquivos .msf (MobileSheets Song File) para MusicXML 3.1
Desempacota contêineres ZIP/SQLite/binários, extrai PDFs, imagens ou partituras embutidas
e utiliza o Google Gemini para transcrever com precisão para MusicXML para Orquestra de Sinos.
"""

import sys
import os
import re
import time
import json
import zipfile
import sqlite3
import argparse
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
from google import genai
from google.genai import types

_gemini_client = None

def get_gemini_client():
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    load_dotenv('/var/www/html/sinos/.env', override=True)
    if not os.getenv('GEMINI_API_KEY'):
        load_dotenv('/var/www/html/aprendizado/backend/.env', override=True)
    key = os.getenv('GEMINI_API_KEY')
    if not key or not key.strip():
        raise RuntimeError("Nenhuma chave GEMINI_API_KEY configurada. Obtenha uma chave gratuita em aistudio.google.com/app/apikey e salve no Painel Admin do Campana.")
    _gemini_client = genai.Client(api_key=key.strip())
    return _gemini_client

SYSTEM_PROMPT = """Você é um especialista em transcrição e editoração musical profissional especializado em partituras para Orquestra de Sinos (Handbells).
Sua missão é transcrever com precisão ABSOLUTA o arquivo musical fornecido (.msf / PDF / Imagem de partitura) para MusicXML 3.1 completo e bem-formado.

DIRETRIZES TÉCNICAS:
1. ESTRUTURA GRAND STAFF:
   - Part P1 com 2 pautas: Pauta 1 Clave de Sol (G2), Pauta 2 Clave de Fá (F4).
2. CABEÇALHO E ATRIBUTOS:
   - Inclua <score-partwise version="3.1">, <work><work-title>...</work-title></work>, <part-list><score-part id="P1"><part-name>Handbells</part-name></score-part></part-list>.
   - No primeiro compasso, inclua <attributes> (<divisions>4</divisions>, <key><fifths>...</fifths></key>, <time><beats>...</beats><beat-type>...</beat-type></time>, <staves>2</staves>, <clef number="1"><sign>G</sign><line>2</line></clef>, <clef number="2"><sign>F</sign><line>4</line></clef>).
3. POLIFONIA E ACORDES:
   - Use <chord/> para notas simultâneas na mesma pauta.
   - Use <backup><duration>...</duration></backup> para retornar ao início do compasso para a Pauta 2 (ou pautas secundárias).
4. PADRÃO MUSICXML PARA NOTAS:
   - O elemento <step> DEVE conter APENAS a letra maiúscula pura (A, B, C, D, E, F, G).
   - NUNCA coloque acidentes (# ou b) dentro de <step>.
   - Para sustenido, use <step>F</step><alter>1</alter>. Para bemol, use <step>B</step><alter>-1</alter>.
5. RIGOR:
   - É TERMINANTEMENTE PROIBIDO RESUMIR OU OMITIR QUALQUER COMPASSO. Não use comentários do tipo 'continue generating'. Escreva todos os compassos do início ao fim.
   - Retorne APENAS o XML dentro de um bloco ```xml ... ``` ou puro.
"""

MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
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
        print(f"[!] Erro ao atualizar status: {e}")

def call_gemini(contents, system_instruction=SYSTEM_PROMPT):
    c = get_gemini_client()
    last_err = None
    for m in MODELS:
        for attempt in range(2):
            try:
                print(f"[*] Chamando modelo {m} (tentativa {attempt + 1})...")
                resp = c.models.generate_content(
                    model=m,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.1,
                        max_output_tokens=16384
                    )
                )
                if resp.text:
                    return resp.text
            except Exception as e:
                last_err = e
                err_str = str(e)
                print(f"[!] Modelo {m} tentativa {attempt + 1} falhou: {e}")
                if "401" in err_str or "UNAUTHENTICATED" in err_str or "ACCOUNT_STATE_INVALID" in err_str or "API_KEY_INVALID" in err_str:
                    raise RuntimeError("Chave do Google Gemini desativada ou inválida (Erro 401: Conta de serviço desativada no Google Cloud). Gere uma chave gratuita em aistudio.google.com/app/apikey e atualize no Painel Admin ou no arquivo .env.")
                if "403" in err_str or "PERMISSION_DENIED" in err_str:
                    raise RuntimeError("Acesso negado à API do Google Gemini (Erro 403). Verifique se a Generative Language API está habilitada em aistudio.google.com.")
                if "503" in err_str or "UNAVAILABLE" in err_str:
                    print(f"[*] Modelo {m} sobrecarregado (503). Alternando rapidamente para o próximo modelo...")
                    break
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    time.sleep(2 * (attempt + 1))
                    continue
                break
    if last_err:
        raise last_err
    raise RuntimeError("Nenhum modelo Gemini retornou resposta.")

def repair_xml(xml_str):
    # 1. Remove cercas markdown ```xml ou ```
    xml_str = re.sub(r'^\s*```(?:xml)?\s*', '', xml_str, flags=re.IGNORECASE)
    xml_str = re.sub(r'\s*```\s*$', '', xml_str)

    m = re.search(r'```(?:xml)?\s*(<\?xml.*?</score-partwise>|<score-partwise.*?</score-partwise>)\s*```', xml_str, re.DOTALL)
    if m:
        xml_str = m.group(1)
    else:
        m2 = re.search(r'(<\?xml.*?</score-partwise>|<score-partwise.*?</score-partwise>)', xml_str, re.DOTALL)
        if m2:
            xml_str = m2.group(1)

    # 2. Se o XML foi truncado no meio antes de fechar score-partwise, corta no último compasso completo
    if '<score-partwise' in xml_str and '</score-partwise>' not in xml_str:
        last_measure_end = xml_str.rfind('</measure>')
        if last_measure_end != -1:
            xml_str = xml_str[:last_measure_end + len('</measure>')] + '\n  </part>\n</score-partwise>\n'

    # Normaliza acidentes e tags com fechamento incorreto da IA
    xml_str = re.sub(r'<step>\s*([A-Ga-g])#\s*</[^>]+>', r'<step>\1</step><alter>1</alter>', xml_str)
    xml_str = re.sub(r'<step>\s*([A-Ga-g])b\s*</[^>]+>', r'<step>\1</step><alter>-1</alter>', xml_str)
    xml_str = re.sub(r'<step>\s*([A-Ga-g])\s*</[^>]+>', lambda m: f'<step>{m.group(1).upper()}</step>', xml_str)
    xml_str = re.sub(r'<octave>\s*(\d+)\s*</[^>]+>', r'<octave>\1</octave>', xml_str)
    xml_str = re.sub(r'<duration>\s*(\d+)\s*</[^>]+>', r'<duration>\1</duration>', xml_str)
    xml_str = re.sub(r'<type>\s*([a-z]+)\s*</[^>]+>', r'<type>\1</type>', xml_str)
    xml_str = re.sub(r'<voice>\s*(\d+)\s*</[^>]+>', r'<voice>\1</voice>', xml_str)
    xml_str = re.sub(r'<staff>\s*(\d+)\s*</[^>]+>', r'<staff>\1</staff>', xml_str)
    xml_str = re.sub(r'<fifths>\s*(-?\d+)\s*</[^>]+>', r'<fifths>\1</fifths>', xml_str)
    xml_str = re.sub(r'<beats>\s*(\d+)\s*</[^>]+>', r'<beats>\1</beats>', xml_str)
    xml_str = re.sub(r'<beat-type>\s*(\d+)\s*</[^>]+>', r'<beat-type>\1</beat-type>', xml_str)
    xml_str = xml_str.replace('&nbsp;', ' ')

    # Corrige pausas <rest/> vazias sem duration/type geradas por IA que quebram o OSMD
    xml_str = re.sub(r'<note>\s*(?:<print[^>]*>.*?<\/print>\s*)?<rest\s*\/?>\s*<\/note>', r'<note><rest/><duration>16</duration><type>whole</type></note>', xml_str)

    # Fechamentos automáticos
    if '</part>' not in xml_str and '<part' in xml_str:
        xml_str += '\n  </part>'
    if '</score-partwise>' not in xml_str and '<score-partwise' in xml_str:
        xml_str += '\n</score-partwise>\n'

    # Normalização e cura estrutural completa (ElementTree)
    try:
        xml_str = structural_xml_repair(xml_str)
    except Exception as e:
        print(f"[!] Aviso: structural_xml_repair falhou: {e}")

    return xml_str

def get_duration_type(duration, divisions=2):
    ratio = duration / max(1, divisions)
    if ratio >= 4.0: return "whole"
    elif ratio >= 3.0: return "half"
    elif ratio >= 2.0: return "half"
    elif ratio >= 1.5: return "quarter"
    elif ratio >= 1.0: return "quarter"
    elif ratio >= 0.5: return "eighth"
    else: return "16th"

def get_type_duration(note_type, divisions=2):
    mapping = {
        "whole": int(divisions * 4),
        "half": int(divisions * 2),
        "quarter": int(divisions * 1),
        "eighth": max(1, int(divisions * 0.5)),
        "16th": max(1, int(divisions * 0.25))
    }
    return mapping.get(note_type, divisions)

def structural_xml_repair(xml_str):
    try:
        root = ET.fromstring(xml_str)
    except Exception:
        return xml_str

    divisions = 2
    m1 = root.find(".//measure[1]")
    if m1 is not None:
        attr = m1.find("attributes")
        if attr is not None and attr.findtext("divisions"):
            try:
                divisions = int(attr.findtext("divisions"))
            except:
                pass

    for m in root.findall(".//measure"):
        m_attr = m.find("attributes")
        if m_attr is not None and m_attr.findtext("divisions"):
            try:
                divisions = int(m_attr.findtext("divisions"))
            except:
                pass

        current_staff = 1
        current_voice = 1
        last_non_chord_note = None

        for child in list(m):
            if child.tag == "backup":
                if current_staff == 1:
                    current_staff = 2
                    current_voice = 2
                else:
                    current_voice += 1
                last_non_chord_note = None
                continue

            if child.tag != "note":
                continue

            n = child
            is_chord = n.find("chord") is not None
            pitch = n.find("pitch")
            rest = n.find("rest")

            if is_chord and last_non_chord_note is not None:
                if n.find("duration") is None and last_non_chord_note.find("duration") is not None:
                    dur_elem = ET.Element("duration")
                    dur_elem.text = last_non_chord_note.findtext("duration")
                    n.append(dur_elem)
                if n.find("type") is None and last_non_chord_note.find("type") is not None:
                    type_elem = ET.Element("type")
                    type_elem.text = last_non_chord_note.findtext("type")
                    n.append(type_elem)
                if n.find("staff") is None:
                    staff_val = last_non_chord_note.findtext("staff") or str(current_staff)
                    staff_elem = ET.Element("staff")
                    staff_elem.text = staff_val
                    n.append(staff_elem)
                if n.find("voice") is None:
                    voice_val = last_non_chord_note.findtext("voice") or str(current_voice)
                    voice_elem = ET.Element("voice")
                    voice_elem.text = voice_val
                    n.append(voice_elem)
                continue

            last_non_chord_note = n

            staff_elem = n.find("staff")
            if staff_elem is None:
                staff_elem = ET.Element("staff")
                staff_elem.text = str(current_staff)
                n.append(staff_elem)
            else:
                try:
                    current_staff = int(staff_elem.text)
                except:
                    current_staff = 1

            voice_elem = n.find("voice")
            if voice_elem is None:
                voice_elem = ET.Element("voice")
                voice_elem.text = "1" if current_staff == 1 else "2"
                n.append(voice_elem)

            dur_elem = n.find("duration")
            typ_elem = n.find("type")

            if dur_elem is None and typ_elem is not None:
                dur_val = get_type_duration(typ_elem.text, divisions)
                dur_elem = ET.Element("duration")
                dur_elem.text = str(dur_val)
                n.append(dur_elem)

            if typ_elem is None and dur_elem is not None:
                try:
                    d_int = int(dur_elem.text)
                    t_val = get_duration_type(d_int, divisions)
                    typ_elem = ET.Element("type")
                    typ_elem.text = t_val
                    n.append(typ_elem)
                except:
                    pass

            if rest is not None:
                if typ_elem is None:
                    typ_elem = ET.Element("type")
                    typ_elem.text = "whole"
                    n.append(typ_elem)
                if dur_elem is None:
                    dur_elem = ET.Element("duration")
                    dur_elem.text = str(divisions * 4)
                    n.append(dur_elem)

    DTD_ORDER = [
        "grace", "cue", "chord", "pitch", "unpitched", "rest", "duration",
        "tie", "voice", "type", "dot", "accidental", "time-modification",
        "stem", "notehead", "staff", "beam", "notations", "lyric"
    ]

    for m in root.findall(".//measure"):
        for n in m.findall("note"):
            children = list(n)
            def key_func(elem):
                if elem.tag in DTD_ORDER:
                    return DTD_ORDER.index(elem.tag)
                return 999
            children_sorted = sorted(children, key=key_func)
            for c in children:
                n.remove(c)
            for c in children_sorted:
                n.append(c)

    return ET.tostring(root, encoding="unicode", xml_declaration=True)


def extract_from_msf(msf_path):
    """
    Inspeciona o arquivo .msf e tenta desempacotar:
    1. ZIP archive
    2. SQLite database
    3. Extração direta de stream %PDF- ... %%EOF
    4. Imagens embutidas JPEG/PNG
    5. Texto puro / XML
    """
    results = {
        "pdfs": [],
        "images": [],
        "xmls": [],
        "text": None,
        "raw_bytes": None
    }

    with open(msf_path, "rb") as f:
        data = f.read()

    results["raw_bytes"] = data

    # 0. Se for um arquivo PDF diretamente
    if msf_path.lower().endswith('.pdf') or data.startswith(b'%PDF-'):
        print(f"[✓] Arquivo PDF direto detectado ({len(data)} bytes).")
        results["pdfs"].append((os.path.basename(msf_path), data))
        return results

    # 1. Tenta como ZIP
    if data.startswith(b'PK\x03\x04') or zipfile.is_zipfile(msf_path):
        try:
            with zipfile.ZipFile(msf_path, 'r') as zf:
                for name in zf.namelist():
                    lower = name.lower()
                    content = zf.read(name)
                    if lower.endswith(('.xml', '.musicxml', '.mxml')):
                        results["xmls"].append((name, content))
                    elif lower.endswith('.pdf'):
                        results["pdfs"].append((name, content))
                    elif lower.endswith(('.jpg', '.jpeg', '.png', '.webp')):
                        results["images"].append((name, content))
            if results["xmls"] or results["pdfs"] or results["images"]:
                print(f"[✓] Arquivo ZIP descompactado com sucesso: {len(results['xmls'])} XMLs, {len(results['pdfs'])} PDFs, {len(results['images'])} imagens.")
                return results
        except Exception as e:
            print(f"[!] Falha ao extrair ZIP: {e}")

    # 2. Tenta como SQLite
    if data.startswith(b'SQLite format 3'):
        try:
            conn = sqlite3.connect(msf_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in cursor.fetchall()]
            print(f"[*] SQLite encontrado com tabelas: {tables}")
            # Procura por colunas blob
            for t in tables:
                cursor.execute(f"PRAGMA table_info({t});")
                cols = [c[1] for c in cursor.fetchall()]
                for col in cols:
                    try:
                        cursor.execute(f"SELECT {col} FROM {t} WHERE {col} IS NOT NULL LIMIT 10;")
                        for row in cursor.fetchall():
                            val = row[0]
                            if isinstance(val, bytes):
                                if val.startswith(b'%PDF-'):
                                    results["pdfs"].append((f"{t}_{col}.pdf", val))
                                elif val.startswith(b'\xff\xd8\xff'):
                                    results["images"].append((f"{t}_{col}.jpg", val))
                                elif val.startswith(b'\x89PNG'):
                                    results["images"].append((f"{t}_{col}.png", val))
                                elif b'<score-partwise' in val or b'<?xml' in val:
                                    results["xmls"].append((f"{t}_{col}.xml", val))
                    except:
                        pass
            conn.close()
            if results["xmls"] or results["pdfs"] or results["images"]:
                return results
        except Exception as e:
            print(f"[!] Falha ao ler SQLite: {e}")

    # 3. Busca por fluxo %PDF- ... %%EOF embutido
    pdf_starts = [m.start() for m in re.finditer(rb'%PDF-[0-9.]+', data)]
    if pdf_starts:
        print(f"[*] Encontrados {len(pdf_starts)} marcador(es) PDF no arquivo .msf.")
        for idx, start_pos in enumerate(pdf_starts):
            eof_pos = data.find(b'%%EOF', start_pos)
            if eof_pos != -1:
                pdf_bytes = data[start_pos : eof_pos + 5]
            else:
                pdf_bytes = data[start_pos:]
            if len(pdf_bytes) > 200:
                results["pdfs"].append((f"embedded_score_{idx+1}.pdf", pdf_bytes))

    # 4. Busca por imagens JPEG/PNG embutidas
    jpg_starts = [m.start() for m in re.finditer(b'\xff\xd8\xff', data)]
    if jpg_starts:
        for idx, start_pos in enumerate(jpg_starts[:5]):
            end_pos = data.find(b'\xff\xd9', start_pos)
            if end_pos != -1 and (end_pos - start_pos) > 1000:
                results["images"].append((f"embedded_page_{idx+1}.jpg", data[start_pos : end_pos + 2]))

    # 5. Verifica se há texto legível ou XML
    try:
        text_sample = data.decode('utf-8', errors='ignore')
        if '<score-partwise' in text_sample or '<?xml' in text_sample:
            xml_m = re.search(r'(<\?xml.*?</score-partwise>|<score-partwise.*?</score-partwise>)', text_sample, re.DOTALL)
            if xml_m:
                results["xmls"].append(("extracted.xml", xml_m.group(1).encode('utf-8')))
        results["text"] = text_sample
    except:
        pass

    return results

def save_score_meta(output_xml_path, title, uploader_name="Sineiro", uploader_email=""):
    try:
        data_dir = "/var/www/html/sinos/data"
        os.makedirs(data_dir, exist_ok=True)
        meta_file = os.path.join(data_dir, "scores_meta.json")
        meta = {}
        if os.path.exists(meta_file):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
            except Exception:
                meta = {}
        filename = os.path.basename(output_xml_path)
        meta[filename] = {
            "title": title,
            "uploaded_by": {
                "name": uploader_name or "Sineiro",
                "email": (uploader_email or "").lower().strip()
            },
            "created_at": int(time.time())
        }
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"[✓] Metadados registrados em {meta_file} para {filename}")
    except Exception as e:
        print(f"[!] Erro ao salvar scores_meta: {e}")

def extract_measures(xml_text):
    cleaned = re.sub(r'^\s*```(?:xml)?\s*', '', xml_text, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*```\s*$', '', cleaned)
    measures = re.findall(r'(<measure\s+number="(\d+)"[^>]*>.*?</measure>)', cleaned, re.DOTALL)
    if not measures:
        measures = re.findall(r'(<measure\s+number=\'(\d+)\'[^>]*>.*?</measure>)', cleaned, re.DOTALL)
    result = []
    for full_tag, num in measures:
        result.append((int(num), full_tag))
    return result

def convert_pdf_multipage(pdf_path, output_xml_path, title, job_file=None, user_name="Sineiro", user_email=""):
    import subprocess, glob, shutil, tempfile
    temp_dir = tempfile.mkdtemp(prefix="sinos_pdf_")
    try:
        update_job_status(job_file, "processing", "Renderizando páginas do PDF em alta resolução...", 20)
        prefix = os.path.join(temp_dir, "page")
        cmd = ["/usr/bin/pdftoppm", "-jpeg", "-r", "150", pdf_path, prefix]
        subprocess.run(cmd, check=True)
        
        page_files = sorted(glob.glob(os.path.join(temp_dir, "page-*.jpg")))
        valid_pages = [p for p in page_files if os.path.getsize(p) > 10240]
        if not valid_pages:
            valid_pages = page_files

        total_pages = len(valid_pages)
        print(f"[*] PDF renderizado em {total_pages} páginas válidas para transcrição.")
        
        all_measures = []
        for idx, page_img in enumerate(valid_pages):
            p_num = idx + 1
            pct = 25 + int((idx / total_pages) * 65)
            update_job_status(job_file, "transcribing", f"Transcrevendo página {p_num} de {total_pages} com IA musical...", pct, {"current_page": p_num, "total_pages": total_pages})
            print(f"[*] Transcrevendo página {p_num}/{total_pages} ({os.path.basename(page_img)})...")
            
            with open(page_img, "rb") as f:
                img_bytes = f.read()
                
            prompt = (
                f"Você é um perito em transcrição de partituras musicais para Orquestra de Sinos (Handbells).\n"
                f"Esta imagem é a Página {p_num} de {total_pages} da partitura '{title}'.\n"
                "DIRETRIZES TÉCNICAS:\n"
                "1. Transcreva com fidelidade ABSOLUTA todas as notas, pausas, acordes (<chord/>), claves e tempos desta página.\n"
                "2. 2 pautas: Staff 1 (Clave de Sol) e Staff 2 (Clave de Fá). Use <backup> para alternar pautas/vozes.\n"
                "3. Formate cada elemento <note> concisamente em linha única (ex: <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type><staff>1</staff></note>) para caber na resposta.\n"
                "4. Transcreva todos os compassos da página do início ao fim sem omitir nada.\n"
                "5. Retorne os blocos <measure number=\"...\">...</measure> completos."
            )
            
            img_part = types.Part.from_bytes(data=img_bytes, mime_type='image/jpeg')
            raw_xml = call_gemini([prompt, img_part])
            
            extracted = extract_measures(raw_xml)
            print(f"[✓] Página {p_num}: {len(extracted)} compassos extraídos.")
            for m_num, m_content in extracted:
                all_measures.append((m_num, m_content))
                
        all_measures.sort(key=lambda x: x[0])
        print(f"[✓] Total de compassos coletados de todas as páginas: {len(all_measures)}")
        
        header = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>{title}</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Handbells</part-name>
      <part-abbreviation>H.B.</part-abbreviation>
    </score-part>
  </part-list>
  <part id="P1">
'''
        footer = '''  </part>
</score-partwise>
'''
        measures_xml = "\n".join([m[1] for m in all_measures])
        full_xml = header + measures_xml + "\n" + footer
        final_xml = repair_xml(full_xml)
        
        with open(output_xml_path, "w", encoding="utf-8") as out:
            out.write(final_xml)
        save_score_meta(output_xml_path, title, user_name, user_email)
        update_job_status(job_file, "completed", "Conversão de partitura PDF concluída com sucesso!", 100, {"output": os.path.basename(output_xml_path)})
        print(f"[✓] Partitura salva em {output_xml_path}")
        return True
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def convert_msf(msf_path, output_xml_path, song_title=None, job_file=None, user_name="Sineiro", user_email=""):
    update_job_status(job_file, "analyzing", "Examinando estrutura do arquivo...", 10)
    print(f"[*] Analisando arquivo: {msf_path}")

    # Se for PDF diretamente
    if msf_path.lower().endswith('.pdf'):
        title = song_title or os.path.splitext(os.path.basename(msf_path))[0].replace('_', ' ')
        return convert_pdf_multipage(msf_path, output_xml_path, title, job_file, user_name, user_email)

    extracted = extract_from_msf(msf_path)
    title = song_title or os.path.splitext(os.path.basename(msf_path))[0].replace('_', ' ')

    # Caso 1: MusicXML já existia embutido diretamente!
    if extracted["xmls"]:
        update_job_status(job_file, "converting", "Partitura XML encontrada internamente. Validando...", 70)
        xml_data = extracted["xmls"][0][1]
        if isinstance(xml_data, bytes):
            xml_str = xml_data.decode('utf-8', errors='ignore')
        else:
            xml_str = str(xml_data)
        final_xml = repair_xml(xml_str)
        with open(output_xml_path, "w", encoding="utf-8") as out:
            out.write(final_xml)
        save_score_meta(output_xml_path, title, user_name, user_email)
        update_job_status(job_file, "completed", "Conversão concluída com sucesso!", 100, {"output": os.path.basename(output_xml_path)})
        print(f"[✓] XML salvo diretamente em: {output_xml_path}")
        return True

    # Caso 2: Contém PDF embutido
    if extracted["pdfs"]:
        pdf_name, pdf_bytes = extracted["pdfs"][0]
        temp_pdf = output_xml_path + ".temp.pdf"
        with open(temp_pdf, "wb") as f_tmp:
            f_tmp.write(pdf_bytes)
        try:
            return convert_pdf_multipage(temp_pdf, output_xml_path, title, job_file, user_name, user_email)
        finally:
            if os.path.exists(temp_pdf):
                os.remove(temp_pdf)

    # Caso 3: Contém imagens embutidas
    if extracted["images"]:
        update_job_status(job_file, "processing", f"Encontradas {len(extracted['images'])} imagem(ns) no .msf. Transcrevendo via IA...", 30)
        parts = [f"Transcreva a partitura contida nestas imagens da música '{title}' para MusicXML 3.1 para Handbells:"]
        for img_name, img_bytes in extracted["images"]:
            mime = "image/png" if img_name.endswith('.png') else "image/jpeg"
            parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
        
        update_job_status(job_file, "transcribing", "Gemini transcrevendo compassos e notas...", 65)
        response_text = call_gemini(parts)
        final_xml = repair_xml(response_text)
        with open(output_xml_path, "w", encoding="utf-8") as out:
            out.write(final_xml)
        save_score_meta(output_xml_path, title, user_name, user_email)
        update_job_status(job_file, "completed", "Conversão de .msf para MusicXML concluída!", 100, {"output": os.path.basename(output_xml_path)})
        print(f"[✓] Partitura convertida e salva em: {output_xml_path}")
        return True

    # Caso 4: Transcrição direta do conteúdo binário/textual do .msf via Gemini
    update_job_status(job_file, "processing", "Analisando dados musicais do arquivo .msf via Gemini IA...", 40)
    raw_sample = extracted["raw_bytes"][:500000] # Até 500KB
    doc_part = types.Part.from_bytes(data=raw_sample, mime_type="application/octet-stream")
    prompt = f"""O arquivo anexo é uma partitura exportada pelo MobileSheets (.msf) com o título '{title}'.
Analise a estrutura dos dados, identifique as notas musicais, compassos, armadura de clave, fórmula de compasso e andamento,
e gere uma partitura MusicXML 3.1 bem-formatada e completa para Orquestra de Sinos (Handbells com Grand Staff: Clave de Sol e Fá)."""
    
    update_job_status(job_file, "transcribing", "Gerando partitura MusicXML 3.1...", 70)
    response_text = call_gemini([prompt, doc_part])
    final_xml = repair_xml(response_text)

    with open(output_xml_path, "w", encoding="utf-8") as out:
        out.write(final_xml)

    save_score_meta(output_xml_path, title, user_name, user_email)
    update_job_status(job_file, "completed", "Conversão concluída!", 100, {"output": os.path.basename(output_xml_path)})
    print(f"[✓] Partitura MusicXML salva com sucesso em: {output_xml_path}")
    return True

def main():
    parser = argparse.ArgumentParser(description="Converte arquivos .msf para MusicXML 3.1")
    parser.add_argument("msf_file", help="Caminho do arquivo .msf")
    parser.add_argument("-o", "--output", help="Caminho do arquivo MusicXML de saída", default=None)
    parser.add_argument("-t", "--title", help="Título da música", default=None)
    parser.add_argument("-j", "--job-file", help="Caminho do arquivo de status JSON", default=None)
    parser.add_argument("--user-name", help="Nome de quem enviou", default="Sineiro")
    parser.add_argument("--user-email", help="E-mail de quem enviou", default="")

    args = parser.parse_args()

    if not os.path.isfile(args.msf_file):
        print(f"Erro: Arquivo {args.msf_file} não encontrado.")
        sys.exit(1)

    out_file = args.output
    if not out_file:
        base = os.path.splitext(os.path.basename(args.msf_file))[0]
        out_file = os.path.join("/var/www/html/sinos/scores", f"{base}.musicxml")

    try:
        convert_msf(args.msf_file, out_file, args.title, args.job_file, args.user_name, args.user_email)
    except Exception as e:
        print(f"[!] Erro fatal na conversão: {e}")
        err_msg = str(e)
        if "401" in err_msg or "UNAUTHENTICATED" in err_msg or "ACCOUNT_STATE_INVALID" in err_msg:
            user_msg = "Chave do Google Gemini desativada ou inválida (Erro 401). Obtenha uma chave gratuita em aistudio.google.com/app/apikey e configure no Painel de Administrador ou no arquivo .env."
        elif "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
            user_msg = "Limite temporário de requisições do Gemini atingido (Erro 429). Aguarde alguns instantes e tente novamente."
        elif "403" in err_msg or "PERMISSION_DENIED" in err_msg:
            user_msg = "Acesso negado à API do Google Gemini (Erro 403). Verifique se a Generative Language API está habilitada."
        else:
            user_msg = f"Falha na conversão: {err_msg}"
        update_job_status(args.job_file, "error", user_msg)
        sys.exit(1)

if __name__ == "__main__":
    main()
