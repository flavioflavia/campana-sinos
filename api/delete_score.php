<?php
/**
 * API Endpoint: /api/delete_score.php
 * Exclui com segurança um arquivo de partitura da pasta scores/
 * REGRA ESTRITA: Apenas o administrador flavioflavia@gmail.com tem permissão para excluir partituras.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido. Use POST ou DELETE.']);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$adminEmail = 'flavioflavia@gmail.com';

// Obtém os dados da requisição (JSON ou form-data)
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$filename = '';
$userEmail = $_SESSION['sinos_user_email'] ?? ($_SERVER['HTTP_X_USER_EMAIL'] ?? '');

if (is_array($data)) {
    $filename = $data['filename'] ?? '';
    if (empty($userEmail)) {
        $userEmail = $data['user_email'] ?? ($data['email'] ?? '');
    }
} elseif (!empty($_POST['filename'])) {
    $filename = $_POST['filename'];
    if (empty($userEmail)) {
        $userEmail = $_POST['user_email'] ?? ($_POST['email'] ?? '');
    }
}

$userEmail = strtolower(trim($userEmail));

// VALIDAÇÃO ESTRITA DE PERMISSÃO DO ADMINISTRADOR
if ($userEmail !== strtolower($adminEmail)) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Acesso negado. Apenas o administrador (' . $adminEmail . ') tem permissão para excluir partituras do acervo.'
    ]);
    exit;
}

$scoresDir = realpath('/var/www/html/sinos/scores');
if (!$scoresDir) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Diretório de partituras não encontrado.']);
    exit;
}

if (empty($filename)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Parâmetro "filename" obrigatório.']);
    exit;
}

// Higieniza nome do arquivo contra path traversal
$base = basename($filename);
$target = $scoresDir . DIRECTORY_SEPARATOR . $base;

// Protege contra exclusão acidental do hino padrão base
if ($base === 'hino-da-alegria.musicxml') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'A partitura padrão "Hino à Alegria" é essencial para o aplicativo e não pode ser excluída.']);
    exit;
}

// Valida extensão permitida
$ext = strtolower(pathinfo($target, PATHINFO_EXTENSION));
if (!in_array($ext, ['musicxml', 'mxl', 'xml', 'mxml', 'msf'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Extensão de arquivo inválida para exclusão.']);
    exit;
}

if (!file_exists($target)) {
    echo json_encode([
        'success' => true,
        'message' => 'O arquivo já não se encontra no disco do servidor.',
        'deleted' => $base
    ]);
    exit;
}

if (@unlink($target)) {
    // Remove também eventuais escalas de sinos salvas para esta música
    $assignmentsFile = '/var/www/html/sinos/data/assignments.json';
    if (file_exists($assignmentsFile)) {
        $assignments = json_decode(@file_get_contents($assignmentsFile), true);
        if (is_array($assignments) && isset($assignments[$base])) {
            unset($assignments[$base]);
            file_put_contents($assignmentsFile, json_encode($assignments, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Partitura apagada com sucesso pelo administrador.',
        'deleted' => $base
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Não foi possível apagar o arquivo do servidor. Verifique permissões.']);
}
