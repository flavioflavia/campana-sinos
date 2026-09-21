# 🔔 Campana - Orquestra de Sinos (Handbells)

> **Estúdio Interativo para Estudo e Ensaio de Partituras em Orquestras de Sinos (Handbells)**  
> Marque seus sinos, acompanhe a partitura compasso por compasso e veja suas notas brilharem na tela no momento exato do toque!

[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)
[![MusicXML 3.1](https://img.shields.io/badge/Standard-MusicXML_3.1-blue.svg)](https://www.w3.org/2021/06/musicxml31/)
[![Web Audio API](https://img.shields.io/badge/Audio-Web_Audio_API-green.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![OpenSheetMusicDisplay](https://img.shields.io/badge/Renderer-OpenSheetMusicDisplay-orange.svg)](https://opensheetmusicdisplay.org/)
[![Google Gemini Vision](https://img.shields.io/badge/AI_OMR-Google_Gemini_Vision-4285F4.svg)](https://ai.google.dev/)

---

## 📖 Visão Geral

Tocar em uma **orquestra de sinos (handbell choir)** é uma experiência musical única e desafiadora: cada integrante é responsável por apenas 2 ou 4 sinos específicos (por exemplo, `C5` e `D5`), tendo que contar compassos e entrar com extrema precisão em meio a dezenas de outras notas tocadas pelos colegas.

O **Campana** foi desenvolvido para resolver a maior dor dos sineiros: **ensaiar em casa sem a orquestra completa**. 

O aplicativo renderiza a partitura completa, toca o acompanhamento com timbres sintéticos ultra-realistas de sinos ingleses e alerta visualmente o músico antes e durante o instante exato em que ele deve soar o seu sino.

---

## ✨ Principais Funcionalidades

### 🎼 1. Renderização Interativa de Partituras
- Suporte nativo ao formato universal **MusicXML 3.1** (`.musicxml`, `.mxl` e `.xml`).
- Renderização vetorial cristalina via **OpenSheetMusicDisplay (SVG)**.
- Visualização vertical paginada (Formato A4) com margens, quebras de página físicas e sombras de papel.
- **Clique Direto na Partitura**: Basta clicar em qualquer nota na pauta para ouvir seu tom e atribuí-la instantaneamente ao seu conjunto de estudo!

### 🔔 2. Mesa de Sinos Interativa (Handbell Rack)
- Abrangência completa de 4 oitavas:
  - **Oitava 3 (Sinos Graves / Baixos)**: `C3` a `B3`
  - **Oitava 4 (Médios / Pauta Grave)**: `C4` a `B4`
  - **Oitava 5 (Melodia Principal)**: `C5` a `B5`
  - **Oitava 6 (Agudos e Super-Agudos)**: `C6` a `B6`
- **Atalhos por Tocador (Ringers)**: 12 predefinições ergonômicas prontas para uso (`Baixos 1`, `Médios 1`, `Central`, `Melodia`, etc.).
- Identificação visual de mãos: alterne entre **Mão Direita (M.D.)** e **Mão Esquerda (M.E.)** com um clique.

### 🎧 3. Áudio de Sinos de Alta Fidelidade (Web Audio API)
- Síntese aditiva com modelagem física de harmônicos metálicos dos sinos ingleses:
  - Fundamental pura com decaimento exponencial longo.
  - Transiente de ataque metálico (*clapper strike*).
  - 12 harmônicos parciais ressonantes com leve modulação de batimento acústico (*beating*).
- Três perfis de timbre selecionáveis: **Sinos Ingleses Clássicos**, **Chimes Tubulares** e **Handbells Cristalinos**.

### 🎯 4. Modos de Prática e Estudo
- **Prática Assistida (Recomendado)**: Toca todas as notas da partitura, destacando as suas notas em cores vivas no compasso atual e alertando no tempo anterior (*"Levante o sino!"*).
- **Modo Mudo (Solo)**: Silencia apenas os sinos que você toca para que você toque o sino físico na sua casa, enquanto o computador toca o restante da orquestra como acompanhamento!
- **Ouvir Tudo**: Modo demonstração para escutar o arranjo completo.

### ⏱️ 5. Ferramentas de Ensaio
- **Controle de Andamento**: Slider e botões rápidos (0.5x, 0.75x, 1x, 1.25x) com aceleração e desaceleração contínua sem alterar a afinação.
- **Metrônomo Integrado**: Sincronizado com os tempos e compassos da partitura.
- **Contagem Prévia (Count-in)**: Compasso preparatório com cliques para você respirar e entrar no tempo certo.

### 📸 6. Escaneamento e Transcrição por IA (Google Gemini Vision)
- Tire fotos das folhas da sua partitura física com o celular e envie para o Campana.
- A inteligência artificial analisa as pautas, claves, armaduras e compassos polifônicos, transcrevendo tudo para MusicXML 3.1.
- **Processamento Assíncrono com Barra de Progresso**: Arquitetura desacoplada que processa múltiplas páginas sem travamentos ou timeouts de rede.

### 📂 7. Carregamento e Gerenciamento
- **Carregar XML**: Envie arquivos `.musicxml` ou `.mxl` do MuseScore, Sibelius ou Finale.
- **Drag & Drop**: Arraste a partitura de qualquer pasta do seu computador direto para a janela do navegador.
- **🗑️ Apagar Partitura**: Remova músicas personalizadas com confirmação e segurança.

---

## ⌨️ Atalhos de Teclado

| Tecla | Ação |
| :---: | :--- |
| <kbd>Espaço</kbd> | Tocar / Pausar a execução |
| <kbd>Esc</kbd> | Parar execução e voltar ao compasso 1 |
| <kbd>M</kbd> | Ligar / Desligar o Metrônomo |
| <kbd>F</kbd> | Alternar Modo Tela Cheia |

---

## 🏗️ Arquitetura do Projeto

```
sinos/
├── index.html                  # Interface principal da aplicação (SPA)
├── style.css                   # Folha de estilos moderna (Dark theme + papel de partitura)
├── app.js                      # Controlador da aplicação, estado e eventos do DOM
├── bell-audio.js               # Motor de síntese de áudio Web Audio API para handbells
├── score-player.js             # Timeline de playback, metrônomo e sincronização do cursor
├── omr_engine.py               # Motor Python de OMR via Google GenAI SDK (Gemini Vision)
├── generate_scores.js          # Utilitário para geração de partituras demonstrativas
├── .env.example                # Modelo de variáveis de ambiente
├── .gitignore                  # Arquivos ignorados pelo controle de versão
├── api/
│   ├── transcribe.php          # Inicia job assíncrono de transcrição OMR
│   ├── transcribe_status.php   # Endpoint de polling para progresso em tempo real
│   └── delete_score.php        # Exclusão segura de partituras do servidor
├── libs/
│   ├── opensheetmusicdisplay.min.js # Biblioteca de renderização vetorial OSMD
│   └── jszip.min.js            # Descompactação client-side de arquivos .mxl
├── scores/                     # Acervo de partituras MusicXML pré-instaladas
│   ├── hino-da-alegria.musicxml
│   ├── noite-feliz.musicxml
│   ├── canon-em-re.musicxml
│   └── brilha-brilha-estrelinha.musicxml
└── uploads/                    # Diretório temporário para jobs de transcrição
```

---

## 🚀 Como Instalar e Rodar

### Requisitos Prévios
- Servidor Web (**Apache** ou **Nginx**) com suporte a **PHP 8.0+**.
- **Python 3.10+** (para o recurso de transcrição via IA).
- Chave de API do **Google Gemini** (gratuita em [Google AI Studio](https://aistudio.google.com/)).

### 1. Clonar o Repositório
```bash
git clone https://github.com/flavioflavia/campana-sinos.git /var/www/html/sinos
cd /var/www/html/sinos
```

### 2. Configurar o Ambiente Python (para IA OMR)
Crie um ambiente virtual Python e instale o SDK oficial do Google GenAI:
```bash
python3 -m venv venv
source venv/bin/activate
pip install google-genai python-dotenv
```

### 3. Configurar Chaves de API
Copie o modelo de variáveis de ambiente e insira sua chave do Gemini:
```bash
cp .env.example .env
nano .env
```
Conteúdo do arquivo `.env`:
```env
GEMINI_API_KEY=sua_chave_do_google_ai_studio_aqui
```

### 4. Ajustar Permissões de Pastas
Certifique-se de que o servidor web possa ler e escrever nas pastas `scores/` e `uploads/`:
```bash
chown -R www-data:www-data /var/www/html/sinos
chmod -R 775 /var/www/html/sinos
```

### 5. Configurar o Servidor Web (Exemplo Apache)
Adicione um VirtualHost no Apache (ex: `/etc/apache2/sites-available/sinos.conf`):
```apache
<VirtualHost *:80>
    ServerName sinos.seu-dominio.com.br
    DocumentRoot /var/www/html/sinos

    <Directory /var/www/html/sinos>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    AddType application/xml .musicxml .xml
    AddType application/vnd.recordare.musicxml+xml .mxl

    ErrorLog ${APACHE_LOG_DIR}/sinos_error.log
    CustomLog ${APACHE_LOG_DIR}/sinos_access.log combined
</VirtualHost>
```
Habilite o site e recarregue o Apache:
```bash
sudo a2ensite sinos.conf
sudo a2enmod headers
sudo systemctl reload apache2
```

Se desejar habilitar HTTPS com Let's Encrypt:
```bash
sudo certbot --apache -d sinos.seu-dominio.com.br
```

---

## 🎼 Dicas para Adicionar Suas Próprias Partituras

1. **MuseScore / Finale / Sibelius**:
   - Abra sua partitura para Handbells no seu editor de partituras preferido.
   - Vá em **Arquivo > Exportar > MusicXML (.musicxml ou .mxl)**.
   - No Campana, clique em **📂 Carregar XML** ou simplesmente arraste o arquivo para a janela.

2. **Fotos e Escaneamentos via Celular**:
   - Para obter a melhor qualidade na transcrição por IA, tire fotos bem iluminadas, sem sombras e mantendo a folha plana e alinhada.
   - Envie as folhas em ordem (Folha 1, Folha 2, etc.) no botão **📸 Escanear Fotos (IA)**.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [`LICENSE`](LICENSE) para mais detalhes.

---

## 👤 Autor

Desenvolvido por **Flavio Franca**  
E-mail: [flavioflavia@gmail.com](mailto:flavioflavia@gmail.com)  
GitHub: [@flavioflavia](https://github.com/flavioflavia)
