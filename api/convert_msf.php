<?php
/**
 * API Endpoint: /api/convert_msf.php
 * Recebe arquivo .pdf ou .msf/.msb e inicia a conversão para MusicXML
 * via convert_msf.py e Google Gemini.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido. Use POST.']);
    exit;
}

ini_set('memory_limit', '256M');

$uploadDir = '/var/www/html/sinos/uploads/';
$scoresDir = '/var/www/html/sinos/scores/';
$pythonBin = '/var/www/html/aprendizado/backend/venv/bin/python3';
$scriptPath = '/var/www/html/sinos/convert_msf.py';

if (!is_dir($uploadDir)) @mkdir($uploadDir, 0775, true);
if (!is_dir($scoresDir)) @mkdir($scoresDir, 0775, true);

// Verifica se o POST foi truncado por post_max_size
if (empty($_FILES) && empty($_POST) && isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH'] > 0) {
    http_response_code(413);
    $sizeMb = round(((int)$_SERVER['CONTENT_LENGTH']) / (1024 * 1024), 1);
    echo json_encode([
        'success' => false,
        'error' => "O arquivo enviado é muito grande ({$sizeMb} MB) e excedeu o limite máximo de POST do servidor (100 MB)."
    ]);
    exit;
}

$rawFile = $_FILES['file'] ?? $_FILES['msf_file'] ?? null;
if ($rawFile && isset($rawFile['error']) && $rawFile['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    $errMsg = match ($rawFile['error']) {
        UPLOAD_ERR_INI_SIZE => 'O arquivo enviado excede o limite máximo permitido pelo servidor (upload_max_filesize de 100 MB).',
        UPLOAD_ERR_FORM_SIZE => 'O arquivo enviado excede o limite de tamanho do formulário.',
        UPLOAD_ERR_PARTIAL => 'O envio do arquivo foi interrompido antes de ser concluído.',
        UPLOAD_ERR_NO_FILE => 'Nenhum arquivo foi selecionado para upload.',
        UPLOAD_ERR_NO_TMP_DIR => 'Diretório temporário de upload ausente no servidor.',
        UPLOAD_ERR_CANT_WRITE => 'Falha ao salvar o arquivo temporário no disco do servidor.',
        default => 'Erro no upload do arquivo (código PHP: ' . $rawFile['error'] . ').'
    };
    echo json_encode(['success' => false, 'error' => $errMsg]);
    exit;
}

$fileField = null;
if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    $fileField = $_FILES['file'];
} elseif (isset($_FILES['msf_file']) && $_FILES['msf_file']['error'] === UPLOAD_ERR_OK) {
    $fileField = $_FILES['msf_file'];
}

if (!$fileField || empty($fileField['name'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nenhum arquivo (.pdf, .msf ou .msb) foi recebido no upload.']);
    exit;
}

$origName = $fileField['name'];
$ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

if (!in_array($ext, ['msf', 'msb', 'pdf'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Extensão de arquivo inválida. Apenas arquivos .pdf, .msf ou .msb são aceitos neste conversor.']);
    exit;
}

$title = trim($_POST['title'] ?? pathinfo($origName, PATHINFO_FILENAME));
$prefix = ($ext === 'pdf') ? 'pdf_' : 'msf_';
$jobId = $prefix . date('Ymd_His') . '_' . bin2hex(random_bytes(4));

$savedInput = $uploadDir . $jobId . '.' . $ext;
if (!move_uploaded_file($fileField['tmp_name'], $savedInput)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Falha ao salvar o arquivo no servidor.']);
    exit;
}

// Higieniza o nome de saída MusicXML
$cleanTitle = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $title);
$cleanTitle = preg_replace('/_+/', '_', trim($cleanTitle, '_'));
if (empty($cleanTitle)) {
    $cleanTitle = 'musica_' . $ext . '_' . date('Ymd_His');
}

$outputXmlFilename = strtolower($cleanTitle) . '.musicxml';
$outputPath = $scoresDir . $outputXmlFilename;
if (file_exists($outputPath)) {
    $outputXmlFilename = strtolower($cleanTitle) . '_' . substr(md5(uniqid()), 0, 4) . '.musicxml';
    $outputPath = $scoresDir . $outputXmlFilename;
}

$jobFile = $uploadDir . 'job_' . $jobId . '.json';
$initialStatus = [
    'jobId' => $jobId,
    'status' => 'pending',
    'message' => ($ext === 'pdf' ? 'Partitura PDF recebida. Iniciando processamento com Gemini...' : 'Arquivo .msf recebido. Iniciando descompactação e conversão...'),
    'percent' => 5,
    'title' => $title,
    'outputFilename' => $outputXmlFilename,
    'created_at' => time()
];
file_put_contents($jobFile, json_encode($initialStatus, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

$userName = trim($_POST['user_name'] ?? '');
$userEmail = trim($_POST['user_email'] ?? ($_SERVER['HTTP_X_USER_EMAIL'] ?? ''));

// Executa em segundo plano
$cmd = sprintf(
    '%s %s %s -o %s -t %s -j %s --user-name %s --user-email %s > /dev/null 2>&1 &',
    escapeshellarg($pythonBin),
    escapeshellarg($scriptPath),
    escapeshellarg($savedInput),
    escapeshellarg($outputPath),
    escapeshellarg($title),
    escapeshellarg($jobFile),
    escapeshellarg($userName),
    escapeshellarg($userEmail)
);

exec($cmd);

echo json_encode([
    'success' => true,
    'jobId' => $jobId,
    'message' => 'Conversão iniciada com sucesso em segundo plano.',
    'outputFilename' => $outputXmlFilename
]);
