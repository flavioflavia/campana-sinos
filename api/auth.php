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

    // Alterar senha (exclusivo para o usuário autenticado / admin)
    case 'change_password':
        $requesterEmail = $_SESSION['sinos_user_email'] ?? ($_SERVER['HTTP_X_USER_EMAIL'] ?? ($body['admin_email'] ?? ($body['email'] ?? '')));
        $requesterEmail = strtolower(trim($requesterEmail));

        if (empty($requesterEmail) || !isset($users[$requesterEmail])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Sessão não autenticada. Faça login como administrador primeiro.']);
            exit;
        }

        $currentPassword = $body['current_password'] ?? '';
        $newPassword = $body['new_password'] ?? '';

        if (empty($currentPassword)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Informe a senha atual.']);
            exit;
        }

        if (strlen($newPassword) < 4) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'A nova senha deve possuir no mínimo 4 caracteres.']);
            exit;
        }

        $user = $users[$requesterEmail];
        // Valida se a senha atual confere
        if (!empty($user['password_hash']) && !password_verify($currentPassword, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'A senha atual digitada está incorreta.']);
            exit;
        }

        // Grava o novo hash de senha
        $users[$requesterEmail]['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
        saveUsers($usersFile, $users);

        echo json_encode([
            'success' => true,
            'message' => 'Senha de Administrador alterada com sucesso!'
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

    // Excluir perfil de sineiro (EXCLUSIVO PARA O ADMINISTRADOR flavioflavia@gmail.com)
    case 'delete_ringer':
    case 'delete_user':
        // Identifica e-mail de quem solicita a exclusão
        $requesterEmail = $_SESSION['sinos_user_email'] ?? ($_SERVER['HTTP_X_USER_EMAIL'] ?? ($body['admin_email'] ?? ($body['requester_email'] ?? '')));
        $requesterEmail = strtolower(trim($requesterEmail));

        if ($requesterEmail !== strtolower($adminEmail)) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'Acesso negado. Apenas o administrador (' . $adminEmail . ') tem permissão para remover sineiros.'
            ]);
            exit;
        }

        $targetEmail = strtolower(trim($body['email'] ?? ''));
        if (empty($targetEmail)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'E-mail do sineiro a ser removido não informado.']);
            exit;
        }

        if ($targetEmail === strtolower($adminEmail)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'O perfil do Administrador principal não pode ser removido.']);
            exit;
        }

        if (!isset($users[$targetEmail])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Sineiro não encontrado no cadastro.']);
            exit;
        }

        $removedName = $users[$targetEmail]['name'] ?? $targetEmail;
        unset($users[$targetEmail]);
        saveUsers($usersFile, $users);

        // Limpa atribuições/escalas desse usuário em todas as músicas
        $assignmentsFile = $dataDir . '/assignments.json';
        if (file_exists($assignmentsFile)) {
            $assignments = json_decode(@file_get_contents($assignmentsFile), true);
            if (is_array($assignments)) {
                $changed = false;
                foreach ($assignments as $song => $userList) {
                    if (isset($assignments[$song][$targetEmail])) {
                        unset($assignments[$song][$targetEmail]);
                        $changed = true;
                    }
                }
                if ($changed) {
                    file_put_contents($assignmentsFile, json_encode($assignments, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                }
            }
        }

        // Se o usuário excluído era o que estava na sessão, retorna a sessão para o admin
        if (isset($_SESSION['sinos_user_email']) && strtolower($_SESSION['sinos_user_email']) === $targetEmail) {
            $_SESSION['sinos_user_email'] = $adminEmail;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Perfil do sineiro "' . $removedName . '" foi removido com sucesso pelo administrador.',
            'removed_email' => $targetEmail
        ]);
        break;

    // Obter status da chave de API do Gemini (.env)
    case 'get_gemini_config':
        $requesterEmail = $_SESSION['sinos_user_email'] ?? ($_SERVER['HTTP_X_USER_EMAIL'] ?? ($body['admin_email'] ?? ''));
        $isAdmin = (strtolower(trim($requesterEmail)) === strtolower($adminEmail));

        $envFile = '/var/www/html/sinos/.env';
        $currentKey = '';
        if (file_exists($envFile)) {
            $envLines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($envLines as $line) {
                if (preg_match('/^\s*GEMINI_API_KEY\s*=\s*["\']?(.*?)["\']?\s*$/', $line, $m)) {
                    $currentKey = trim($m[1]);
                    break;
                }
            }
        }

        $hasKey = !empty($currentKey);
        $masked = '';
        if ($hasKey) {
            $len = strlen($currentKey);
            if ($len > 12) {
                $masked = substr($currentKey, 0, 8) . '...' . substr($currentKey, -4);
            } else {
                $masked = '********';
            }
        }

        echo json_encode([
            'success' => true,
            'is_admin' => $isAdmin,
            'has_key' => $hasKey,
            'masked_key' => $masked
        ]);
        break;

    // Salvar nova chave de API do Gemini (.env)
    case 'save_gemini_key':
        $requesterEmail = $_SESSION['sinos_user_email'] ?? ($_SERVER['HTTP_X_USER_EMAIL'] ?? ($body['admin_email'] ?? ''));
        if (strtolower(trim($requesterEmail)) !== strtolower($adminEmail)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Apenas o administrador (' . $adminEmail . ') pode configurar a chave da API.']);
            exit;
        }

        $newKey = trim($body['gemini_api_key'] ?? '');
        if (empty($newKey)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'A chave de API não pode estar vazia.']);
            exit;
        }

        $newKey = trim($newKey, "\"' \t\n\r\0\x0B");

        $envFile = '/var/www/html/sinos/.env';
        $content = "GEMINI_API_KEY=\"" . addslashes($newKey) . "\"\n";
        if (file_put_contents($envFile, $content) === false) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erro ao salvar a chave no arquivo .env']);
            exit;
        }

        $altEnv = '/var/www/html/aprendizado/backend/.env';
        if (file_exists($altEnv) && is_writable($altEnv)) {
            @file_put_contents($altEnv, $content);
        }

        $masked = strlen($newKey) > 12 ? substr($newKey, 0, 8) . '...' . substr($newKey, -4) : '********';
        echo json_encode([
            'success' => true,
            'message' => 'Chave da API Gemini salva com sucesso no sistema!',
            'masked_key' => $masked
        ]);
        break;

    // Testar chave de API do Gemini fazendo chamada ao Google
    case 'test_gemini_key':
        $requesterEmail = $_SESSION['sinos_user_email'] ?? ($_SERVER['HTTP_X_USER_EMAIL'] ?? ($body['admin_email'] ?? ''));
        if (strtolower(trim($requesterEmail)) !== strtolower($adminEmail)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Apenas o administrador pode testar a chave.']);
            exit;
        }

        $testKey = trim($body['gemini_api_key'] ?? '');
        if (empty($testKey)) {
            $envFile = '/var/www/html/sinos/.env';
            if (file_exists($envFile)) {
                $envLines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($envLines as $line) {
                    if (preg_match('/^\s*GEMINI_API_KEY\s*=\s*["\']?(.*?)["\']?\s*$/', $line, $m)) {
                        $testKey = trim($m[1]);
                        break;
                    }
                }
            }
        }

        $testKey = trim($testKey, "\"' \t\n\r\0\x0B");
        if (empty($testKey)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nenhuma chave fornecida ou encontrada no .env para teste.']);
            exit;
        }

        $url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' . urlencode($testKey);
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        $resp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            echo json_encode([
                'success' => false,
                'valid' => false,
                'error' => 'Falha de rede ao conectar com o Google: ' . $curlErr
            ]);
            exit;
        }

        $respData = json_decode($resp, true);
        if ($httpCode === 200 && isset($respData['models'])) {
            $numModels = count($respData['models']);
            echo json_encode([
                'success' => true,
                'valid' => true,
                'message' => "✓ Chave válida! Conectada com sucesso à Google Generative AI ({$numModels} modelos disponíveis)."
            ]);
        } else {
            $errMsg = $respData['error']['message'] ?? "Código HTTP {$httpCode}";
            $errStatus = $respData['error']['status'] ?? 'ERRO';
            $reason = $respData['error']['details'][0]['reason'] ?? '';
            $friendlyMsg = "Erro {$httpCode} ({$errStatus}): {$errMsg}";
            if ($httpCode === 401) {
                if ($reason === 'ACCOUNT_STATE_INVALID' || strpos($errMsg, 'service account is deleted') !== false) {
                    $friendlyMsg = "Erro 401: A conta de serviço do Google vinculada a esta chave foi desativada ou excluída. Crie uma nova chave gratuita em aistudio.google.com/app/apikey.";
                } else {
                    $friendlyMsg = "Erro 401 (Não autenticado): Chave inválida ou incorreta. Copie a chave completa gerada no Google AI Studio.";
                }
            } elseif ($httpCode === 403) {
                $friendlyMsg = "Erro 403: Acesso negado. Certifique-se de que a API Generative Language está habilitada no projeto.";
            }

            echo json_encode([
                'success' => false,
                'valid' => false,
                'http_code' => $httpCode,
                'error' => $friendlyMsg,
                'raw_details' => $respData['error'] ?? null
            ]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ação inválida.']);
        break;
}
