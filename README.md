# 🔔 Campana - Orquestra de Sinos (Handbells)

> **Estúdio Web Interativo para Estudo, Ensaio e Regência em Orquestras de Sinos (Handbells & Tonechimes)**  
> Marque seus sinos, acompanhe a partitura compasso por compasso, veja suas notas brilharem na tela e sincronize todo o coro em tempo real!

[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)
[![MusicXML 3.1](https://img.shields.io/badge/Standard-MusicXML_3.1-blue.svg)](https://www.w3.org/2021/06/musicxml31/)
[![Web Audio API](https://img.shields.io/badge/Audio-Web_Audio_API-green.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline_Ready-purple.svg)](manifest.json)
[![OpenSheetMusicDisplay](https://img.shields.io/badge/Renderer-OpenSheetMusicDisplay-orange.svg)](https://opensheetmusicdisplay.org/)
[![Google Gemini Vision](https://img.shields.io/badge/AI_OMR-Google_Gemini_Vision-4285F4.svg)](https://ai.google.dev/)

---

## 📖 Visão Geral

Tocar em uma **orquestra de sinos (handbell choir)** é uma das artes musicais coletivas mais desafiadoras: cada sineiro é responsável por 2 a 4 sinos específicos (por exemplo, `C5` e `D5` na mão direita e `G4` na mão esquerda), precisando contar tempos com rigor cirúrgico para soar a nota exata na fração de segundo correta.

O **Campana** resolve a maior dor dos grupos de sinos: **estudar em casa com precisão sem precisar reunir a orquestra inteira**.

O aplicativo carrega partituras em MusicXML, MobileSheets (`.msf`) e PDF, renderiza as pautas em alta resolução, sintetiza o som físico dos sinos ingleses de bronze, guia a execução visualmente com cores e sincroniza toda a orquestra sob o comando do regente.

---

## ✨ Funcionalidades Principais

### 🎼 1. Renderização Vetorial de Partituras
- Suporte nativo ao formato padrão **MusicXML 3.1** (`.musicxml`, `.mxl`, `.xml`).
- Renderização vetorial cristalina via **OpenSheetMusicDisplay (OSMD)** sobre SVG.
- Formatação vertical em páginas A4 com paginação real, margens e sombras de papel.
- **Clique Direto na Pauta**: Clique em qualquer nota da partitura para ouvir seu tom e atribuí-la instantaneamente ao seu conjunto de estudo.

### 🔔 2. Mesa de Sinos Interativa (Handbell Rack)
- Abrangência de 4 oitavas cromáticas completas (da Oitava 3 grave à Oitava 6 aguda):
  - **Oitava 3 (Sinos Graves / Baixos)**: `C3` a `B3`
  - **Oitava 4 (Médios / Pauta de Fá)**: `C4` a `B4`
  - **Oitava 5 (Melodia Principal / Pauta de Sol)**: `C5` a `B5`
  - **Oitava 6 (Agudos e Super-Agudos)**: `C6` a `B6`
- **Atalhos Rápidos por Tocador (Ringers 1 a 12)**: Predefinições ergonômicas prontas para uso.
- Identificação de pegada: alterne entre **Mão Direita (M.D.)** e **Mão Esquerda (M.E.)** com um clique.

### 🎧 3. Fidelidade Acústica das Técnicas de Handbells
- Síntese aditiva física de sinos de bronze ingleses (*English Handbells*), tubos melódicos (*Tonechimes*) e *Glockenspiel*:
  - **Normal (Ring)**: Ataque com decaimento exponencial natural de bronze polido.
  - **LV (Let Vibrate)**: Sustentação ressonante longa (~6.5s) sem corte entre notas subsequentes.
  - **Damp**: Abafamento rápido da cauda sonora no final da figura rítmica.
  - **Martellato (Mart. / ▼)**: Batida no feltro da mesa com transiente percussivo e corpo abafado (0.4s).
  - **Shake (Sk. / ~~~)**: Tremolo com LFO senoidal a 5.8 Hz modulando a amplitude do sino.
  - **Pluck (Pl. / +)**: Ataque percussivo seco do badalo preso na mesa com amortecimento rápido.

### 🔁 4. Loop de Trecho Difícil & Treino Acelerador
- Marque o **Ponto A** (compasso inicial) e o **Ponto B** (compasso final) diretamente durante a reprodução.
- **Modo Loop A-B**: Repete indefinidamente passagens rápidas ou complexas sem interrupções.
- **Treino Acelerador**: Aumenta automaticamente **+5%** no andamento a cada volta completada, permitindo ao sineiro começar lento (ex: 50%) e alcançar a velocidade final da música gradativamente.

### ⚠️ 5. Alerta de Trocas Rápidas de Sinos (Detecção de Weaving)
- Algoritmo que inspeciona a partitura buscando passagens com transições rápidas do mesmo sineiro (< 1.4s na mesma mão ou < 0.8s entre mãos).
- Lista os compassos críticos no painel lateral; clicar no item transporta o cursor diretamente para o compasso em questão.
- Durante o playback, o **Live Cue HUD** alerta com antecedência: `⚠️ Atenção M.D.: Troca rápida de C5 para E5!`.

### 👥 6. Escala Geral da Música & Detecção de Notas Órfãs
- O botão **`🎼 Escala Geral`** gera o mapa completo de distribuição de sinos da música carregada.
- **Detecção de Notas Órfãs**: Destaca em vermelho pulsante sinos exigidos no arranjo que não estão atribuídos a nenhum integrante da orquestra.
- **Atribuição Instantânea**: Permite que o regente ou qualquer sineiro clique em `+ Tocar este Sino` para assumir a nota na hora.

### 🎙️ 7. Afinador Acústico & Treino Interativo ("Ouça meu Sino")
- Processamento de sinal com o algoritmo de **Autocorrelação Normalizada (YIN)** via microfone:
  - **Afinador de Bancada**: Mostra em tempo real a nota detectada (ex: `C5`), frequência em Hz e desvio em cents (-50 a +50) com agulha visual e indicador de afinação exata (`Afinado! ✅`).
  - **Treino Interativo**: Em modo *Treino Solo*, o microfone avalia o toque do sino físico do sineiro, validando se ele tocou na hora e afinação corretas, com pontuação, taxa de precisão e sequência (*streak*).

### 📡 8. Maestro Sync (Sincronização Coletiva em Ensaios)
- Sincronização via API com arquitetura híbrida Server-Sent Events (SSE) e Long-Polling:
  - **Modo Regente (Maestro)**: Controla a execução da orquestra a partir de seu tablet. Ao dar Play, Pausar, mudar o andamento (BPM) ou saltar para qualquer compasso, todos os tablets acompanham instantaneamente.
  - **Modo Sineiro (Seguidor)**: A partitura conecta-se ao maestro e segue os comandos do regente em tempo real.

### 📱 9. Modo Offline PWA (Progressive Web App)
- Totalmente instalável na tela inicial de iPads, celulares Android, iPhones e desktops.
- Suporte a funcionamento **100% offline** através de Service Worker (`sw.js`), permitindo ensaiar em igrejas, retiros ou palcos sem conexão de internet.

### 🖨️ 10. Exportação e Impressão de Partituras em PDF com Destaque
- O botão **`🖨️ Imprimir PDF`** formata a partitura em `@media print` de alta resolução:
  - Fundo branco de alto contraste, sem botões de interface.
  - Cabeçalho profissional com título, compositor e nome do sineiro.
  - **Legenda Colorida de Sinos**: Chips visuais indicando as notas e mãos correspondentes (ex: `[🟡 C5 - Mão Direita]`).
  - Notas na pauta mantêm as cores destacadas personalizadas para impressão em cores.

### 📑 11. Conversor Inteligente de Arquivos MobileSheets (.MSF) e PDFs
- Importe arquivos de backup `.msf` do MobileSheets ou partituras em PDF.
- Motor de conversão com reparação estrutural automática de MusicXML (cura compassos sem pausas, acordes malformados e inconsistências de vozes polifônicas).

### 👤 12. Gestão Multi-usuário & Segurança do Administrador
- Novos acessos iniciam em modo **Visitante** sem auto-login de administrador.
- **Cadastro Simples de Sineiros**: Qualquer integrante pode registrar seu nome e e-mail para salvar notas personalizadas por partitura.
- **Troca Rápida de Perfil & Deslogar**: Botão de alternância e botão **Deslogar / Sair** integrados ao perfil.
- **Inclusão Livre de Músicas**: Qualquer integrante ou visitante pode enviar/converter novas partituras para o acervo.
- **Privilégios Estritos do Administrador** (`flavioflavia@gmail.com`):
  - Exige autenticação por senha para ativar o modo Admin.
  - Permissão exclusiva para excluir partituras e remover perfis de sineiros.
  - Alteração de senha administrativa protegida e configuração segura da chave IA Gemini.
  - Exclusão segura com confirmação e limpeza de escalas associadas.

### 📌 13. Barra de Controles Sticky (Sempre Visível)
- Cabeçalho e barra de reprodução fixados no topo com rolagem independente da partitura (`app-top-sticky`).
- Permite pausar, alterar andamento e visualizar o compasso atual mesmo nas últimas páginas de obras longas.

---

## ⌨️ Atalhos de Teclado & Pedais Bluetooth

| Tecla / Pedal | Ação |
| :---: | :--- |
| <kbd>Espaço</kbd> | Tocar / Pausar a execução |
| <kbd>Esc</kbd> | Parar execução e voltar ao início |
| <kbd>Seta Esquerda</kbd> | Voltar 1 compasso (compatível com pedais PageFlip / AirTurn) |
| <kbd>Seta Direita</kbd> | Avançar 1 compasso (compatível com pedais PageFlip / AirTurn) |
| <kbd>M</kbd> | Ligar / Desligar o Metrônomo |
| <kbd>F</kbd> | Alternar Modo Tela Cheia (Estante de Partitura) |

---

## 🏗️ Estrutura do Repositório

```
sinos/
├── index.html                  # Interface principal com barra sticky, modais e PWA tags
├── style.css                   # Tema moderno escuro + layout A4 de partitura + folha de impressão
├── app.js                      # Controlador principal, eventos, estado e integração de módulos
├── bell-audio.js               # Motor de síntese física Web Audio API (Bronze, Chime, Glockenspiel e técnicas)
├── score-player.js             # Timeline precisa de reprodução, Loop A-B, acelerador e cursor OSMD
├── pitch-detector.js           # Detector acústico de altura via microfone (Autocorrelação YIN)
├── sw.js                       # Service Worker para suporte a cache e modo offline PWA
├── manifest.json               # Web App Manifest para instalação em dispositivos móveis
├── convert_msf.py              # Script Python de extração de MobileSheets e sanitização XML
├── omr_engine.py               # Motor Python de OMR via Google GenAI SDK (Gemini Vision)
├── generate_scores.js          # Utilitário para geração de partituras de demonstração
├── .env.example                # Modelo de variáveis de ambiente
├── .gitignore                  # Arquivos ignorados pelo Git (dados locais, caches)
├── api/
│   ├── auth.php                # Autenticação de usuários, perfil, admin e troca de senha
│   ├── assignments.php         # Armazenamento e consulta da escala de sinos por música
│   ├── list_scores.php         # Listagem dinâmica de partituras cadastradas
│   ├── upload_score.php        # Upload e validação de partituras MusicXML
│   ├── delete_score.php        # Exclusão segura de partituras (restrita ao admin)
│   ├── convert_msf.php         # Processamento de arquivos .msf do MobileSheets
│   ├── sync.php                # Servidor de sincronização do Maestro Sync (broadcast, poll e SSE)
│   ├── transcribe.php          # Inicia jobs de transcrição OMR via Gemini Vision
│   └── transcribe_status.php   # Endpoint de polling do status da transcrição
├── data/
│   ├── users.json              # Cadastro de sineiros e credenciais administrativas
│   ├── assignments.json        # Mapeamento de sinos atribuídos por usuário e música
│   └── sync_session.json       # Estado da sessão em tempo real do Maestro Sync
├── libs/
│   ├── opensheetmusicdisplay.min.js # Motor de renderização vetorial OSMD
│   └── jszip.min.js            # Manipulação de arquivos compactados .mxl no navegador
└── scores/                     # Acervo de partituras MusicXML prontas
    ├── hino-da-alegria.musicxml
    ├── shine_jesus_shine.musicxml
    ├── a-mighty-fortess-is-our-god.musicxml
    ├── noite-feliz.musicxml
    ├── canon-em-re.musicxml
    └── brilha-brilha-estrelinha.musicxml
```

---

## 🚀 Como Instalar e Rodar

### Requisitos Prévios
- Servidor Web (**Apache** ou **Nginx**) com suporte a **PHP 8.0+**.
- Módulos PHP: `php-json`, `php-mbstring`, `php-zip`.
- **Python 3.10+** (para o conversor .msf e transcrição via IA).
- Chave de API do **Google Gemini** (opcional, apenas para transcrição de fotos no [Google AI Studio](https://aistudio.google.com/)).

### 1. Clonar o Repositório
```bash
git clone https://github.com/flavioflavia/campana-sinos.git /var/www/html/sinos
cd /var/www/html/sinos
```

### 2. Configurar Permissões de Pastas
```bash
chown -R www-data:www-data /var/www/html/sinos
chmod -R 775 /var/www/html/sinos
chmod 666 /var/www/html/sinos/data/*.json
```

### 3. Configurar Variáveis de Ambiente & Chave Google Gemini (IA)
Para utilizar a transcrição automática de partituras (.msf / PDF / Fotos), é necessário ter uma chave de API do **Google Gemini**:
1. Obtenha uma chave gratuita em [Google AI Studio](https://aistudio.google.com/app/apikey) (clique em *"Create API key"*).
2. Configure a chave de qualquer uma das duas formas:
   - **Pelo próprio aplicativo (Mais fácil)**: Entre como Administrador no botão de usuário (`flavioflavia@gmail.com`), clique em *"✨ Chave IA (Gemini)"*, cole a chave e clique em *"Salvar Chave"* (você pode até testar a conexão na hora com o botão *"Testar Conexão"*).
   - **Pelo terminal / arquivo `.env`**:
     ```bash
     cp .env.example .env
     echo 'GEMINI_API_KEY="sua_chave_aqui"' > .env
     ```

### 4. Configurar Servidor Web (Exemplo Apache)
Certifique-se de habilitar o suporte aos cabeçalhos e MIME types de partituras:
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
</VirtualHost>
```

Habilite os módulos e recarregue:
```bash
sudo a2enmod headers rewrite
sudo systemctl reload apache2
```

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [`LICENSE`](LICENSE) para mais detalhes.

---

## 👤 Autor

Desenvolvido por **Flavio Franca**  
E-mail: [flavioflavia@gmail.com](mailto:flavioflavia@gmail.com)  
GitHub: [@flavioflavia](https://github.com/flavioflavia)
