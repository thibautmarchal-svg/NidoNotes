<?php
require_once __DIR__ . '/core.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// ── GET me ────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'me') {
    if (empty($_SESSION['user'])) err(401, 'Non authentifié');
    ok($_SESSION['user']);
}

// ── POST login ────────────────────────────────────────────────
if ($method === 'POST' && $action === 'login') {
    checkRateLimit('login', 10, 900);
    $d = input();
    $email    = isset($d['email'])    ? trim($d['email'])    : '';
    $password = isset($d['password']) ? trim($d['password']) : '';
    if (!$email || !$password) err(400, 'Email et mot de passe requis');

    $s = db()->prepare("SELECT id, name, email, password FROM nido_notes_teachers WHERE email = ?");
    $s->execute([$email]);
    $teacher = $s->fetch();
    if (!$teacher || !password_verify($password, $teacher['password'])) {
        err(401, 'Email ou mot de passe incorrect');
    }

    $_SESSION['user'] = [
        'id'    => (int)$teacher['id'],
        'name'  => $teacher['name'],
        'email' => $teacher['email'],
    ];
    ok($_SESSION['user']);
}

// ── POST register ────────────────────────────────────────────
if ($method === 'POST' && $action === 'register') {
    checkRateLimit('register', 5, 3600);
    $d = input();
    $name     = isset($d['name'])     ? trim($d['name'])     : '';
    $email    = isset($d['email'])    ? trim($d['email'])    : '';
    $password = isset($d['password']) ? trim($d['password']) : '';
    if (!$name || !$email || !$password) err(400, 'Tous les champs sont requis');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) err(400, 'Email invalide');
    if (strlen($password) < 8) err(400, 'Le mot de passe doit faire au moins 8 caractères');

    $s = db()->prepare("SELECT id FROM nido_notes_teachers WHERE email = ?");
    $s->execute([$email]);
    if ($s->fetch()) err(409, 'Un compte existe déjà avec cet email');

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $ins = db()->prepare("INSERT INTO nido_notes_teachers (name, email, password) VALUES (?, ?, ?)");
    $ins->execute([$name, $email, $hash]);
    $id = (int)db()->lastInsertId();

    $_SESSION['user'] = ['id' => $id, 'name' => $name, 'email' => $email];
    ok($_SESSION['user']);
}

// ── POST logout ──────────────────────────────────────────────
if ($method === 'POST' && $action === 'logout') {
    $_SESSION = [];
    session_destroy();
    ok(['ok' => true]);
}

// ── POST forgot_password ─────────────────────────────────────
if ($method === 'POST' && $action === 'forgot_password') {
    checkRateLimit('forgot', 3, 3600);
    $d = input();
    $email = isset($d['email']) ? trim($d['email']) : '';
    if (!$email) err(400, 'Email requis');

    $s = db()->prepare("SELECT id, name FROM nido_notes_teachers WHERE email = ?");
    $s->execute([$email]);
    $teacher = $s->fetch();
    // Réponse identique même si l'email n'existe pas (sécurité)
    if ($teacher) {
        $token   = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', time() + 3600);
        db()->prepare("UPDATE nido_notes_teachers SET reset_token = ?, reset_expires = ? WHERE id = ?")
            ->execute([$token, $expires, $teacher['id']]);

        $resetUrl = APP_URL . '/#/reset-password?token=' . $token;
        sendResetEmail($teacher['name'], $email, $resetUrl);
    }
    ok(['ok' => true]);
}

// ── POST reset_password ──────────────────────────────────────
if ($method === 'POST' && $action === 'reset_password') {
    $d = input();
    $token    = isset($d['token'])    ? trim($d['token'])    : '';
    $password = isset($d['password']) ? trim($d['password']) : '';
    if (!$token || !$password) err(400, 'Token et mot de passe requis');
    if (strlen($password) < 8) err(400, 'Le mot de passe doit faire au moins 8 caractères');

    $s = db()->prepare("SELECT id FROM nido_notes_teachers WHERE reset_token = ? AND reset_expires > NOW()");
    $s->execute([$token]);
    $teacher = $s->fetch();
    if (!$teacher) err(400, 'Lien expiré ou invalide');

    $hash = password_hash($password, PASSWORD_DEFAULT);
    db()->prepare("UPDATE nido_notes_teachers SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?")
        ->execute([$hash, $teacher['id']]);
    ok(['ok' => true]);
}

err(404, 'Action inconnue');

// ── Mailer ───────────────────────────────────────────────────
function sendResetEmail(string $name, string $to, string $url): void
{
    // PHPMailer non disponible — utiliser mail() natif ou ajouter PHPMailer via Composer
    $subject = 'Réinitialisation de votre mot de passe — Nido Notes';
    $body = "Bonjour {$name},\r\n\r\n"
        . "Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :\r\n"
        . "{$url}\r\n\r\n"
        . "Ce lien expire dans 1 heure.\r\n\r\n"
        . "Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.\r\n\r\n"
        . "— Nido Notes";
    $headers = "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM . ">\r\n"
        . "Reply-To: " . MAIL_FROM . "\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n";
    @mail($to, $subject, $body, $headers);
}
