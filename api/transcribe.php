<?php
/**
 * API Endpoint: /api/transcribe.php
 * Recebe fotos/imagens de partituras e inicia o processo assíncrono de transcrição
 * via Gemini Vision em segundo plano, evitando timeouts de gateway/proxy (Cloudflare 524).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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
$scriptPath = '/var/www/html/sinos/omr_engine.py';

if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0775, true);
}
if (!is_dir($scoresDir)) {
    @mkdir($scoresDir, 0775, true);
}

// Coleta os arquivos enviados (suporta "images" ou "files")
$fileField = null;
if (isset($_FILES['images'])) {
    $fileField = $_FILES['images'];
} elseif (isset($_FILES['files'])) {
    $fileField = $_FILES['files'];
}

if (!$fileField || empty($fileField['name'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nenhuma imagem foi enviada. Envie um ou mais arquivos sob o campo "images[]".']);
    exit;
}

// Normaliza array de arquivos
$uploadedFiles = [];
if (is_array($fileField['name'])) {
    $count = count($fileField['name']);
    for ($i = 0; $i < $count; $i++) {
        if ($fileField['error'][$i] === UPLOAD_ERR_OK) {
            $uploadedFiles[] = [
                'name' => $fileField['name'][$i],
                'tmp_name' => $fileField['tmp_name'][$i],
                'size' => $fileField['size'][$i],
                'type' => $fileField['type'][$i]
            ];
        }
    }
} else {
    if ($fileField['error'] === UPLOAD_ERR_OK) {
        $uploadedFiles[] = [
            'name' => $fileField['name'],
            'tmp_name' => $fileField['tmp_name'],
            'size' => $fileField['size'],
            'type' => $fileField['type']
        ];
    }
}

if (empty($uploadedFiles)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nenhum arquivo válido foi recebido no upload.']);
    exit;
}

// Cria identificador único para o job
$jobId = 'omr_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4));
$tempPaths = [];

foreach ($uploadedFiles as $idx => $file) {
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
        $ext = 'jpeg';
    }
    $tempFile = $uploadDir . $jobId . '_folha' . ($idx + 1) . '.' . $ext;
    if (move_uploaded_file($file['tmp_name'], $tempFile)) {
        $tempPaths[] = $tempFile;
    }
}

if (empty($tempPaths)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Falha ao salvar as imagens recebidas no servidor.']);
    exit;
}

// Título e nome do arquivo de saída
$title = isset($_POST['title']) ? trim($_POST['title']) : '';
$slug = 'partitura_' . date('Ymd_His');
if (!empty($title)) {
    $clean = preg_replace('/[^a-zA-Z0-9_-]+/', '-', strtolower($title));
    $clean = trim($clean, '-');
    if (!empty($clean)) {
        $slug = $clean;
    }
}

$outputFilename = $slug . '.musicxml';
$outputPath = $scoresDir . $outputFilename;
$jobFile = $uploadDir . 'job_' . $jobId . '.json';
$logFile = $uploadDir . 'job_' . $jobId . '.log';

// Registra estado inicial do job
$initialStatus = [
    'jobId' => $jobId,
    'status' => 'queued',
    'message' => 'Imagens carregadas. Iniciando análise via Gemini Vision...',
    'percent' => 5,
    'totalPages' => count($tempPaths),
    'title' => !empty($title) ? $title : pathinfo($outputFilename, PATHINFO_FILENAME),
    'outputFilename' => $outputFilename,
    'created_at' => time()
];
file_put_contents($jobFile, json_encode($initialStatus, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

// Monta comando CLI para execução em segundo plano desacoplada
$cmd = escapeshellcmd($pythonBin) . ' ' . escapeshellarg($scriptPath);
$cmd .= ' --images ' . implode(' ', array_map('escapeshellarg', $tempPaths));
$cmd .= ' --output ' . escapeshellarg($outputPath);
$cmd .= ' --job-file ' . escapeshellarg($jobFile);
if (!empty($title)) {
    $cmd .= ' --title ' . escapeshellarg($title);
}

// Executa em segundo plano com nohup
$bgCmd = "nohup $cmd > " . escapeshellarg($logFile) . " 2>&1 &";
exec($bgCmd);

// Retorna imediatamente para o frontend
echo json_encode([
    'success' => true,
    'jobId' => $jobId,
    'message' => 'Transcrição iniciada com sucesso em segundo plano.',
    'totalPages' => count($tempPaths),
    'title' => !empty($title) ? $title : pathinfo($outputFilename, PATHINFO_FILENAME)
]);
