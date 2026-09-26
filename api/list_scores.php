<?php
/**
 * API Endpoint: /api/list_scores.php
 * Retorna a lista completa de partituras disponíveis na pasta scores/
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$scoresDir = realpath('/var/www/html/sinos/scores');
if (!$scoresDir || !is_dir($scoresDir)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Diretório de partituras não encontrado.']);
    exit;
}

$knownCatalog = [
    'hino-da-alegria.musicxml' => [
        'title' => '🎵 Hino à Alegria (Beethoven - Arranjo Sinos)',
        'order' => 1
    ],
    'a-mighty-fortess-is-our-god.musicxml' => [
        'title' => '🏰 A Mighty Fortress Is Our God (Transcrição IA)',
        'order' => 2
    ],
    'noite-feliz.musicxml' => [
        'title' => '🌟 Noite Feliz (Silent Night - 3/4)',
        'order' => 3
    ],
    'canon-em-re.musicxml' => [
        'title' => '🎼 Canon em Ré (Pachelbel - Sinos)',
        'order' => 4
    ],
    'brilha-brilha-estrelinha.musicxml' => [
        'title' => '✨ Brilha Brilha Estrelinha (Iniciantes)',
        'order' => 5
    ],
    'lord-jesus-christ-with-us-abide.musicxml' => [
        'title' => '⛪ Lord Jesus Christ, With Us Abide (Transcrição IA)',
        'order' => 6
    ]
];

$metaFile = '/var/www/html/sinos/data/scores_meta.json';
$scoresMeta = file_exists($metaFile) ? json_decode(@file_get_contents($metaFile), true) : [];
if (!is_array($scoresMeta)) $scoresMeta = [];

$files = scandir($scoresDir);
$scores = [];

foreach ($files as $file) {
    if ($file === '.' || $file === '..') continue;
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (!in_array($ext, ['musicxml', 'mxl', 'xml', 'mxml'])) continue;

    $url = 'scores/' . $file;
    $filePath = $scoresDir . DIRECTORY_SEPARATOR . $file;
    $fileMtime = filemtime($filePath);

    $metaItem = $scoresMeta[$file] ?? null;
    $uploadedBy = $metaItem['uploaded_by'] ?? null;

    if (isset($knownCatalog[$file])) {
        $scores[] = [
            'url' => $url,
            'filename' => $file,
            'title' => $knownCatalog[$file]['title'],
            'order' => $knownCatalog[$file]['order'],
            'isDefault' => ($file === 'hino-da-alegria.musicxml'),
            'mtime' => $fileMtime,
            'uploaded_by' => $uploadedBy
        ];
    } else {
        // Tenta extrair o título real da partitura
        $displayTitle = '';
        if ($metaItem && !empty($metaItem['title'])) {
            $displayTitle = $metaItem['title'];
        }

        if (empty($displayTitle) && in_array($ext, ['musicxml', 'xml', 'mxml'])) {
            $handle = @fopen($filePath, 'r');
            if ($handle) {
                $head = fread($handle, 4096);
                fclose($handle);
                if (preg_match('/<movement-title[^>]*>([^<]+)<\/movement-title>/i', $head, $m)) {
                    $displayTitle = trim($m[1]);
                } elseif (preg_match('/<work-title[^>]*>([^<]+)<\/work-title>/i', $head, $m)) {
                    $displayTitle = trim($m[1]);
                }
            }
        }

        if (empty($displayTitle)) {
            $raw = pathinfo($file, PATHINFO_FILENAME);
            $displayTitle = trim(str_replace(['_', '-'], ' ', $raw));
        }

        $scores[] = [
            'url' => $url,
            'filename' => $file,
            'title' => '📁 ' . $displayTitle,
            'order' => 100,
            'isDefault' => false,
            'mtime' => $fileMtime,
            'uploaded_by' => $uploadedBy
        ];
    }
}

// Ordena: primeiro a ordem pré-definida, depois por data de modificação mais recente
usort($scores, function ($a, $b) {
    if ($a['order'] !== $b['order']) {
        return $a['order'] - $b['order'];
    }
    return $b['mtime'] - $a['mtime'];
});

echo json_encode([
    'success' => true,
    'scores' => $scores
]);
