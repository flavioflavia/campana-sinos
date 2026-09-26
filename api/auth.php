<?php
/**
 * API Endpoint: /api/auth.php
 * Gerenciamento de Multi-Usuários / Perfis de Sineiros
 * - Administrador: flavioflavia@gmail.com (único com permissão para excluir músicas)
 * - Sineiros: podem visualizar todas as músicas, adicionar novas partituras e gravar seus sinos por música.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$dataDir = '/var/www/html/sinos/data';
$usersFile = $dataDir . '/users.json';
$adminEmail = 'flavioflavia@gmail.com';

if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0775, true);
}

// Inicializa arquivo de usuários com o Admin padrão se não existir
function loadUsers($file, $adminEmail) {
    if (!file_exists($file)) {
        $defaultUsers = [
            $adminEmail => [
                'id' => 'u_admin',
                'name' => 'Flávio (Admin)',
                'email' => $adminEmail,
                'role' => 'admin',
                'password_hash' => password_hash('admin123', PASSWORD_DEFAULT),
                'avatar_color' => '#ffd700',
                'created_at' => time()
            ]
        ];
        file_put_contents($file, json_encode($defaultUsers, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        return $defaultUsers;
    }

    $raw = @file_get_contents($file);
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $data = [];
    }

    // Garante que o e-mail do admin tenha sempre role admin
    if (isset($data[$adminEmail])) {
        $data[$adminEmail]['role'] = 'admin';
    } else {
        $data[$adminEmail] = [
            'id' => 'u_admin',
            'name' => 'Flávio (Admin)',
            'email' => $adminEmail,
            'role' => 'admin',
            'password_hash' => password_hash('admin123', PASSWORD_DEFAULT),
            'avatar_color' => '#ffd700',
            'created_at' => time()
        ];
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    return $data;
}

function saveUsers($file, $users) {
    $tmp = $file . '.tmp';
    file_put_contents($tmp, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    rename($tmp, $file);
}

$users = loadUsers($usersFile, $adminEmail);

// Lê o corpo da requisição (JSON ou POST)
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);
if (!is_array($body)) {
    $body = $_POST;
}

$action = $_GET['action'] ?? ($body['action'] ?? 'get_current');

// Função auxiliar para sanitizar usuário para retorno público (sem hash de senha)
function sanitizeUser($u, $adminEmail) {
    $email = strtolower(trim($u['email'] ?? ''));
    $isAdmin = ($email === strtolower($adminEmail));
    return [
        'id' => $u['id'] ?? ('u_' . md5($email)),
        'name' => $u['name'] ?? 'Sineiro',
        'email' => $email,
        'role' => $isAdmin ? 'admin' : ($u['role'] ?? 'sineiro'),
        'isAdmin' => $isAdmin,
        'avatar_color' => $u['avatar_color'] ?? '#00f5d4'
    ];
}

switch ($action) {
    // Retorna o usuário logado atualmente na sessão ou pelo header X-User-Email
    case 'get_current':
        $currentEmail = $_SESSION['sinos_user_email'] ?? '';
        $headerEmail = $_SERVER['HTTP_X_USER_EMAIL'] ?? '';
        if (!$currentEmail && $headerEmail) {
            $currentEmail = strtolower(trim($headerEmail));
        }

        if ($currentEmail && isset($users[$currentEmail])) {
            echo json_encode([
                'success' => true,
                'logged_in' => true,
                'user' => sanitizeUser($users[$currentEmail], $adminEmail)
            ]);
        } else {
            // Se nenhum usuário logado, retorna o primeiro usuário ou admin como sugestão
            $first = reset($users);
            echo json_encode([
                'success' => true,
                'logged_in' => false,
                'suggested_user' => $first ? sanitizeUser($first, $adminEmail) : null
            ]);
        }
        break;

    // Lista todos os sineiros cadastrados (para troca rápida de perfil no ensaio)
    case 'list_ringers':
        $list = [];
        foreach ($users as $u) {
            $list[] = sanitizeUser($u, $adminEmail);
        }
        // Ordena: Admin primeiro, depois alfabético por nome
        usort($list, function($a, $b) {
            if ($a['isAdmin'] && !$b['isAdmin']) return -1;
            if (!$a['isAdmin'] && $b['isAdmin']) return 1;
            return strcasecmp($a['name'], $b['name']);
        });

        echo json_encode([
            'success' => true,
            'ringers' => $list
        ]);
        break;

    // Login com e-mail e senha
    case 'login':
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';

        if (empty($email)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Informe o e-mail para entrar.']);
            exit;
        }

        if (!isset($users[$email])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Usuário não encontrado. Crie seu perfil de sineiro.']);
            exit;
        }

        $user = $users[$email];
        // Se o usuário tem senha configurada, valida
        if (!empty($user['password_hash'])) {
            if (empty($password) || !password_verify($password, $user['password_hash'])) {
                // Se for a primeira vez do admin e a senha enviada for aceita, ou se senha estiver errada
                http_response_code(401);
                echo json_encode(['success' => false, 'error' => 'Senha incorreta para este sineiro.']);
                exit;
            }
        }

        $_SESSION['sinos_user_email'] = $email;
        echo json_encode([
            'success' => true,
            'message' => 'Login realizado com sucesso!',
            'user' => sanitizeUser($user, $adminEmail)
        ]);
        break;

    // Cadastro de novo sineiro
    case 'register':
        $name = trim($body['name'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $avatarColor = $body['avatar_color'] ?? '#00f5d4';

        if (empty($name) || empty($email)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nome e e-mail são obrigatórios.']);
            exit;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'E-mail em formato inválido.']);
            exit;
        }

        if (isset($users[$email])) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Já existe um perfil cadastrado com este e-mail.']);
            exit;
        }

        $isAdmin = ($email === strtolower($adminEmail));
        $pwdHash = !empty($password) ? password_hash($password, PASSWORD_DEFAULT) : null;

        $newUser = [
            'id' => 'u_' . substr(md5($email . time()), 0, 8),
            'name' => $name,
            'email' => $email,
            'role' => $isAdmin ? 'admin' : 'sineiro',
            'password_hash' => $pwdHash,
            'avatar_color' => $avatarColor,
            'created_at' => time()
        ];

        $users[$email] = $newUser;
        saveUsers($usersFile, $users);

        $_SESSION['sinos_user_email'] = $email;
        echo json_encode([
            'success' => true,
            'message' => 'Sineiro cadastrado com sucesso!',
            'user' => sanitizeUser($newUser, $adminEmail)
        ]);
        break;

    // Troca rápida de perfil (ótimo para tablets compartilhados no ensaio)
    case 'switch_ringer':
        $email = strtolower(trim($body['email'] ?? ''));
        if (empty($email) || !isset($users[$email])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Sineiro não encontrado.']);
            exit;
        }

        $_SESSION['sinos_user_email'] = $email;
        echo json_encode([
            'success' => true,
            'message' => 'Perfil alterado para ' . $users[$email]['name'],
            'user' => sanitizeUser($users[$email], $adminEmail)
        ]);
        break;

    // Logout
    case 'logout':
        unset($_SESSION['sinos_user_email']);
        echo json_encode(['success' => true, 'message' => 'Sessão encerrada.']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ação inválida.']);
        break;
}
