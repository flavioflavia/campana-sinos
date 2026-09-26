<?php
/**
 * API Endpoint: /api/assignments.php
 * Grava e recupera a atribuição de sinos/notas que cada sineiro toca em cada música.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = '/var/www/html/sinos/data';
$assignmentsFile = $dataDir . '/assignments.json';

if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0775, true);
}

function loadAssignments($file) {
    if (!file_exists($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function saveAssignments($file, $data) {
    $tmp = $file . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    rename($tmp, $file);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $scoreId = trim($_GET['score_id'] ?? '');
    $userEmail = strtolower(trim($_GET['user_email'] ?? ''));

    if (empty($scoreId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parâmetro "score_id" é obrigatório.']);
        exit;
    }

    $assignments = loadAssignments($assignmentsFile);
    $scoreAssignments = $assignments[$scoreId] ?? [];

    $userBells = [];
    if (!empty($userEmail) && isset($scoreAssignments[$userEmail])) {
        $userBells = $scoreAssignments[$userEmail]['bells'] ?? [];
    }

    // Monta mapa de resumo da escala da música (qual sineiro toca qual sino)
    $roster = [];
    foreach ($scoreAssignments as $email => $item) {
        $name = $item['name'] ?? $email;
        $bells = $item['bells'] ?? [];
        foreach ($bells as $b) {
            $note = $b['note'] ?? '';
            $hand = $b['hand'] ?? 'both';
            if ($note) {
                if (!isset($roster[$note])) {
                    $roster[$note] = [];
                }
                $roster[$note][] = [
                    'ringer_email' => $email,
                    'ringer_name' => $name,
                    'hand' => $hand
                ];
            }
        }
    }

    echo json_encode([
        'success' => true,
        'score_id' => $scoreId,
        'user_email' => $userEmail,
        'user_bells' => $userBells,
        'all_ringers_bells' => $scoreAssignments,
        'roster' => $roster
    ]);
    exit;
}

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $body = json_decode($rawInput, true);
    if (!is_array($body)) {
        $body = $_POST;
    }

    $scoreId = trim($body['score_id'] ?? '');
    $userEmail = strtolower(trim($body['user_email'] ?? ''));
    $userName = trim($body['user_name'] ?? '');
    $bells = $body['bells'] ?? [];

    if (empty($scoreId) || empty($userEmail)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'score_id e user_email são obrigatórios.']);
        exit;
    }

    // Normaliza bells como lista de objetos [{ note: "C5", hand: "right" }]
    $sanitizedBells = [];
    if (is_array($bells)) {
        foreach ($bells as $item) {
            if (is_string($item)) {
                $sanitizedBells[] = ['note' => trim($item), 'hand' => 'both'];
            } elseif (is_array($item) && !empty($item['note'])) {
                $sanitizedBells[] = [
                    'note' => trim($item['note']),
                    'hand' => in_array($item['hand'] ?? '', ['right', 'left', 'both']) ? $item['hand'] : 'both',
                    'color' => !empty($item['color']) ? trim($item['color']) : null,
                    'activeColor' => !empty($item['activeColor']) ? trim($item['activeColor']) : null
                ];
            }
        }
    }

    $assignments = loadAssignments($assignmentsFile);
    if (!isset($assignments[$scoreId])) {
        $assignments[$scoreId] = [];
    }

    $assignments[$scoreId][$userEmail] = [
        'email' => $userEmail,
        'name' => !empty($userName) ? $userName : $userEmail,
        'bells' => $sanitizedBells,
        'updated_at' => time()
    ];

    saveAssignments($assignmentsFile, $assignments);

    echo json_encode([
        'success' => true,
        'message' => 'Escala de sinos salva com sucesso para esta partitura!',
        'score_id' => $scoreId,
        'user_email' => $userEmail,
        'saved_count' => count($sanitizedBells),
        'bells' => $sanitizedBells
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método não permitido. Use GET ou POST.']);
