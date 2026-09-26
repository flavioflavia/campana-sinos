<?php
/**
 * API Endpoint: /api/convert_msf.php
 * Recebe arquivo .msf (MobileSheets Song File) e inicia a conversão para MusicXML
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

$fileField = null;
if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    $fileField = $_FILES['file'];
} elseif (isset($_FILES['msf_file']) && $_FILES['msf_file']['error'] === UPLOAD_ERR_OK) {
    $fileField = $_FILES['msf_file'];
}

if (!$fileField || empty($fileField['name'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nenhum arquivo .msf foi recebido no upload.']);
    exit;
}

$origName = $fileField['name'];
$ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

if ($ext !== 'msf' && $ext !== 'msb') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Extensão de arquivo inválida. Apenas arquivos .msf ou .msb são aceitos neste conversor.']);
    exit;
}

$title = trim($_POST['title'] ?? pathinfo($origName, PATHINFO_FILENAME));
$jobId = 'msf_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4));

$savedMsf = $uploadDir . $jobId . '.msf';
if (!move_uploaded_file($fileField['tmp_name'], $savedMsf)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Falha ao salvar o arquivo .msf no servidor.']);
    exit;
}

// Higieniza o nome de saída MusicXML
$cleanTitle = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $title);
$cleanTitle = preg_replace('/_+/', '_', trim($cleanTitle, '_'));
if (empty($cleanTitle)) {
    $cleanTitle = 'musica_msf_' . date('Ymd_His');
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
    'message' => 'Arquivo .msf recebido. Iniciando descompactação e conversão...',
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
    escapeshellarg($savedMsf),
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
