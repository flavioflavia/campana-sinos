<?php
/**
 * API Endpoint: /api/transcribe_status.php
 * Consulta o status em tempo real de um processo de transcrição OMR
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$jobId = isset($_GET['jobId']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['jobId']) : '';
if (empty($jobId)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'error' => 'Parâmetro jobId ausente ou inválido.']);
    exit;
}

$jobFile = '/var/www/html/sinos/uploads/job_' . $jobId . '.json';
if (!file_exists($jobFile)) {
    http_response_code(404);
    echo json_encode(['status' => 'not_found', 'error' => 'Trabalho de transcrição não encontrado ou expirado.']);
    exit;
}

$content = file_get_contents($jobFile);
if ($content === false || empty($content)) {
    echo json_encode(['status' => 'processing', 'message' => 'Carregando status...', 'percent' => 0]);
    exit;
}

echo $content;
