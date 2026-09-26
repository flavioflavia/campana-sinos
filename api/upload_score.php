<?php
/**
 * API Endpoint: /api/upload_score.php
 * Salva com segurança um arquivo de partitura no diretório scores/ do servidor
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido. Use POST.']);
    exit;
}

ini_set('memory_limit', '128M');

$scoresDir = realpath('/var/www/html/sinos/scores');
if (!$scoresDir || !is_dir($scoresDir)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Diretório de partituras não encontrado no servidor.']);
    exit;
}

$rawFilename = '';
$fileContent = '';
$title = '';

// Verifica se os dados vieram via JSON ou via Multipart
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== false) {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);
    if (is_array($data)) {
        $rawFilename = $data['filename'] ?? '';
        $fileContent = $data['content'] ?? '';
        $title = $data['title'] ?? '';
    }
} elseif (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    $rawFilename = $_FILES['file']['name'];
    $fileContent = file_get_contents($_FILES['file']['tmp_name']);
    $title = $_POST['title'] ?? '';
} elseif (isset($_POST['content'])) {
    $rawFilename = $_POST['filename'] ?? '';
    $fileContent = $_POST['content'] ?? '';
    $title = $_POST['title'] ?? '';
}

if (empty($fileContent)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nenhum conteúdo de partitura foi recebido.']);
    exit;
}

if (empty($rawFilename)) {
    $rawFilename = 'partitura_' . date('Ymd_His') . '.musicxml';
}

// Extrai título do XML se não foi fornecido
if (empty($title)) {
    if (preg_match('/<movement-title[^>]*>([^<]+)<\/movement-title>/i', substr($fileContent, 0, 4096), $m)) {
        $title = trim($m[1]);
    } elseif (preg_match('/<work-title[^>]*>([^<]+)<\/work-title>/i', substr($fileContent, 0, 4096), $m)) {
        $title = trim($m[1]);
    }
}

// Higieniza o nome base
$info = pathinfo($rawFilename);
$baseName = $info['filename'];
// Remove extensões duplicadas ou caracteres perigosos
$cleanName = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $baseName);
$cleanName = preg_replace('/_+/', '_', $cleanName);
$cleanName = trim($cleanName, '_.-');

if (empty($cleanName)) {
    $cleanName = 'partitura_' . date('Ymd_His');
}

// Partituras enviadas pelo usuário em XML são salvas sempre como .musicxml
$finalFilename = $cleanName . '.musicxml';
$targetPath = $scoresDir . DIRECTORY_SEPARATOR . $finalFilename;

// Se já existir arquivo com esse nome de outro upload, adiciona timestamp para não sobrescrever sem querer
if (file_exists($targetPath)) {
    // Se for o mesmo conteúdo, mantém
    $existing = @file_get_contents($targetPath);
    if ($existing !== $fileContent) {
        $finalFilename = $cleanName . '_' . substr(md5(uniqid()), 0, 6) . '.musicxml';
        $targetPath = $scoresDir . DIRECTORY_SEPARATOR . $finalFilename;
    }
}

if (@file_put_contents($targetPath, $fileContent) === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Não foi possível gravar o arquivo no disco do servidor. Verifique permissões.']);
    exit;
}

@chmod($targetPath, 0664);

$scoreUrl = 'scores/' . $finalFilename;
if (empty($title)) {
    // Formata o nome do arquivo para um título legível
    $title = str_replace(['_', '-'], ' ', $cleanName);
}

// Grava metadados do upload (quem adicionou a música)
$userEmail = $_SESSION['sinos_user_email'] ?? ($_SERVER['HTTP_X_USER_EMAIL'] ?? ($data['user_email'] ?? ($_POST['user_email'] ?? '')));
$userName = $data['user_name'] ?? ($_POST['user_name'] ?? '');

$dataDir = '/var/www/html/sinos/data';
if (!is_dir($dataDir)) @mkdir($dataDir, 0775, true);

$metaFile = $dataDir . '/scores_meta.json';
$meta = file_exists($metaFile) ? json_decode(@file_get_contents($metaFile), true) : [];
if (!is_array($meta)) $meta = [];

$meta[$finalFilename] = [
    'title' => $title,
    'uploaded_by' => [
        'name' => !empty($userName) ? $userName : 'Sineiro',
        'email' => strtolower(trim($userEmail))
    ],
    'created_at' => time()
];
@file_put_contents($metaFile, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo json_encode([
    'success' => true,
    'message' => 'Partitura salva com sucesso no acervo compartilhado.',
    'filename' => $scoreUrl,
    'title' => $title,
    'uploaded_by' => $meta[$finalFilename]['uploaded_by']
]);
