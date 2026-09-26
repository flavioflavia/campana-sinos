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
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
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
    last_err = None
    for m in MODELS:
        for attempt in range(3):
            try:
                print(f"[*] Chamando modelo {m} (tentativa {attempt + 1})...")
                resp = client.models.generate_content(
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
                if "503" in err_str or "UNAVAILABLE" in err_str or "429" in err_str:
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

    return xml_str

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

def convert_msf(msf_path, output_xml_path, song_title=None, job_file=None, user_name="Sineiro", user_email=""):
    update_job_status(job_file, "analyzing", "Examinando estrutura do arquivo .msf...", 10)
    print(f"[*] Analisando arquivo .msf: {msf_path}")

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
        pdf_size_kb = len(pdf_bytes) // 1024
        update_job_status(job_file, "processing", f"Processando partitura em PDF ({pdf_size_kb} KB). Preparando envio para Gemini...", 30)
        print(f"[*] Enviando PDF ({len(pdf_bytes)} bytes, {pdf_size_kb} KB) para transcrição via Gemini...")
        
        prompt = (
            f"Transcreva a partitura musical deste PDF em anexo com o título '{title}'. "
            "Se houver múltiplas páginas, transcreva todas as páginas sequencialmente compasso por compasso do início ao fim. "
            "IMPORTANTE: Formate os elementos <note> de modo conciso em linhas compactas (ex: <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><staff>1</staff></note>) para que toda a música e todos os compassos caibam na resposta sem truncamento. "
            "Retorne o arquivo MusicXML 3.1 completo e bem-formatado para Orquestra de Sinos (Handbells com 2 pautas Clave de Sol e Fá)."
        )
        
        uploaded_gemini_file = None
        temp_pdf_to_clean = None
        try:
            # Se for maior que 10MB, usa a API de arquivos (Files API) do Gemini para evitar estouro de payload REST
            if len(pdf_bytes) > 10 * 1024 * 1024:
                update_job_status(job_file, "processing", f"Upload de PDF grande ({pdf_size_kb // 1024} MB) para a API Gemini...", 40)
                temp_pdf_to_clean = output_xml_path + ".upload.pdf"
                with open(temp_pdf_to_clean, "wb") as f_tmp:
                    f_tmp.write(pdf_bytes)
                print(f"[*] Fazendo upload do PDF grande ({pdf_size_kb // 1024} MB) para Gemini Files API...")
                uploaded_gemini_file = client.files.upload(file=temp_pdf_to_clean, config=dict(mime_type="application/pdf"))
                pdf_input = uploaded_gemini_file
            else:
                pdf_input = types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
            
            update_job_status(job_file, "transcribing", "Gemini gerando notação MusicXML 3.1 com claves e tempos...", 60)
            response_text = call_gemini([prompt, pdf_input])
            
            final_xml = repair_xml(response_text)
            with open(output_xml_path, "w", encoding="utf-8") as out:
                out.write(final_xml)
            save_score_meta(output_xml_path, title, user_name, user_email)
            update_job_status(job_file, "completed", "Conversão de partitura PDF/MSF para MusicXML concluída com sucesso!", 100, {"output": os.path.basename(output_xml_path)})
            print(f"[✓] Partitura convertida e salva em: {output_xml_path}")
            return True
        finally:
            if uploaded_gemini_file:
                try:
                    client.files.delete(name=uploaded_gemini_file.name)
                except Exception as e:
                    print(f"[!] Aviso ao excluir arquivo temporário no Gemini: {e}")
            if temp_pdf_to_clean and os.path.exists(temp_pdf_to_clean):
                try:
                    os.remove(temp_pdf_to_clean)
                except Exception:
                    pass

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
        update_job_status(args.job_file, "error", f"Falha na conversão: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
