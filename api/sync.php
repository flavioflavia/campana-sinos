<?php
/**
 * Maestro Sync API - Sincronização em Tempo Real para Ensaios de Sinos
 * Permite que o Regente conduza o andamento, compasso e play/pause de todos os sineiros simultaneamente.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/../data/sync_session.json';

function getSessionState($file, $sessionId = 'default') {
    if (!file_exists($file)) {
        return [
            'session_id' => $sessionId,
            'is_active' => false,
            'action' => 'stop',
            'measure' => 1,
            'tempo_multiplier' => 1.0,
            'bpm' => 100,
            'score_url' => '',
            'conductor' => '',
            'timestamp' => microtime(true)
        ];
    }
    $raw = @file_get_contents($file);
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return [
            'session_id' => $sessionId,
            'is_active' => false,
            'action' => 'stop',
            'measure' => 1,
            'tempo_multiplier' => 1.0,
            'bpm' => 100,
            'score_url' => '',
            'conductor' => '',
            'timestamp' => microtime(true)
        ];
    }
    return $data;
}

function saveSessionState($file, $state) {
    @file_put_contents($file, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'get_state';
$sessionId = $_GET['session_id'] ?? $_POST['session_id'] ?? 'ensaio_geral';

if ($action === 'broadcast') {
    header('Content-Type: application/json; charset=utf-8');
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        $input = $_POST;
    }

    $currentState = getSessionState($dataFile, $sessionId);

    $newState = [
        'session_id' => $sessionId,
        'is_active' => true,
        'action' => $input['action_type'] ?? $input['action'] ?? 'play',
        'measure' => isset($input['measure']) ? (int)$input['measure'] : 1,
        'tempo_multiplier' => isset($input['tempo_multiplier']) ? (float)$input['tempo_multiplier'] : (isset($input['tempoMultiplier']) ? (float)$input['tempoMultiplier'] : 1.0),
        'bpm' => isset($input['bpm']) ? (int)$input['bpm'] : 100,
        'score_url' => $input['score_url'] ?? $currentState['score_url'] ?? '',
        'conductor' => $input['conductor'] ?? 'Regente',
        'timestamp' => microtime(true)
    ];

    saveSessionState($dataFile, $newState);
    echo json_encode(['success' => true, 'state' => $newState]);
    exit;
}

if ($action === 'poll' || $action === 'get_state') {
    header('Content-Type: application/json; charset=utf-8');
    $since = isset($_GET['since']) ? (float)$_GET['since'] : 0.0;
    $state = getSessionState($dataFile, $sessionId);

    echo json_encode([
        'success' => true,
        'has_update' => ($state['timestamp'] > $since),
        'state' => $state
    ]);
    exit;
}

if ($action === 'stream') {
    // Server-Sent Events (SSE) com fallback rápido
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no'); // Nginx / Apache buffering off

    // Ignora abort para limpar recursos
    ignore_user_abort(true);

    $lastSentTime = 0.0;
    $startTime = time();

    // Executa por até 25 segundos para renovar a conexão sem timeout do PHP
    while (time() - $startTime < 25) {
        if (connection_aborted()) break;

        clearstatcache(true, $dataFile);
        $state = getSessionState($dataFile, $sessionId);

        if ($state['timestamp'] > $lastSentTime) {
            $lastSentTime = $state['timestamp'];
            echo "data: " . json_encode($state) . "\n\n";
            @ob_flush();
            @flush();
        } else {
            // Heartbeat
            echo ": ping\n\n";
            @ob_flush();
            @flush();
        }

        usleep(300000); // 300ms de intervalo
    }
    exit;
}

if ($action === 'reset') {
    header('Content-Type: application/json; charset=utf-8');
    $resetState = [
        'session_id' => $sessionId,
        'is_active' => false,
        'action' => 'stop',
        'measure' => 1,
        'tempo_multiplier' => 1.0,
        'bpm' => 100,
        'score_url' => '',
        'conductor' => '',
        'timestamp' => microtime(true)
    ];
    saveSessionState($dataFile, $resetState);
    echo json_encode(['success' => true, 'state' => $resetState]);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['error' => 'Ação não reconhecida']);
