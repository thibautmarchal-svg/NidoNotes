<?php
require_once __DIR__ . '/config.php';

// ── En-têtes ─────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($origin === APP_URL) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── Session ──────────────────────────────────────────────────
$sess_path = __DIR__ . '/../sessions';
if (!is_dir($sess_path)) mkdir($sess_path, 0750, true);
session_save_path($sess_path);
session_set_cookie_params([
    'lifetime' => 86400 * 30,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// ── Base de données ──────────────────────────────────────────
function db(): PDO
{
    static $pdo;
    if (!$pdo) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    }
    return $pdo;
}

// ── Migrations ───────────────────────────────────────────────
function migrate(): void
{
    $pdo = db();
    $tables = [
        "CREATE TABLE IF NOT EXISTS nido_notes_teachers (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            name          VARCHAR(150) NOT NULL,
            email         VARCHAR(255) NOT NULL UNIQUE,
            password      VARCHAR(255) NOT NULL,
            reset_token   VARCHAR(64)  DEFAULT NULL,
            reset_expires DATETIME     DEFAULT NULL,
            created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS nido_notes_students (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id INT          NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name  VARCHAR(100) NOT NULL,
            created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_teacher (teacher_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS nido_notes_subjects (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id INT          NOT NULL,
            name       VARCHAR(150) NOT NULL,
            created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_teacher (teacher_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS nido_notes_sub_subjects (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id INT          NOT NULL,
            subject_id INT          NOT NULL,
            name       VARCHAR(150) NOT NULL,
            created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_subject (subject_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS nido_notes_evaluations (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id     INT           NOT NULL,
            name           VARCHAR(255)  NOT NULL,
            date           DATE          NOT NULL,
            subject_id     INT           NOT NULL,
            sub_subject_id INT           DEFAULT NULL,
            weight         DECIMAL(3,1)  NOT NULL DEFAULT 1.0,
            created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_teacher (teacher_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS nido_notes_grades (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id    INT           NOT NULL,
            student_id    INT           NOT NULL,
            evaluation_id INT           NOT NULL,
            score         DECIMAL(4,2)  DEFAULT NULL,
            is_absent     TINYINT(1)    NOT NULL DEFAULT 0,
            comment       TEXT          DEFAULT NULL,
            updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_student_eval (student_id, evaluation_id),
            INDEX idx_teacher (teacher_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS nido_notes_rate_limits (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            ip_key       CHAR(64)    NOT NULL,
            action       VARCHAR(32) NOT NULL,
            attempts     SMALLINT    NOT NULL DEFAULT 1,
            window_start DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ip_action (ip_key, action)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    ];
    foreach ($tables as $sql) {
        $pdo->exec($sql);
    }
}
migrate();

// ── Helpers ──────────────────────────────────────────────────
function ok($data = []): void
{
    echo json_encode($data);
    exit;
}

function err(int $code, string $msg): void
{
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function input(): array
{
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function mustAuth(): array
{
    if (empty($_SESSION['user'])) err(401, 'Non authentifié');
    return $_SESSION['user'];
}

// ── Rate limiting ─────────────────────────────────────────────
function checkRateLimit(string $action, int $maxAttempts, int $windowSeconds): void
{
    $ip = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? $_SERVER['HTTP_X_FORWARDED_FOR'] : (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown');
    $key = hash('sha256', $ip);
    $pdo = db();
    $pdo->exec("DELETE FROM nido_notes_rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL {$windowSeconds} SECOND)");
    $s = $pdo->prepare("SELECT attempts FROM nido_notes_rate_limits WHERE ip_key = ? AND action = ?");
    $s->execute([$key, $action]);
    $row = $s->fetch();
    if ($row) {
        if ($row['attempts'] >= $maxAttempts) err(429, 'Trop de tentatives, réessayez plus tard');
        $pdo->prepare("UPDATE nido_notes_rate_limits SET attempts = attempts + 1 WHERE ip_key = ? AND action = ?")
            ->execute([$key, $action]);
    } else {
        $pdo->prepare("INSERT INTO nido_notes_rate_limits (ip_key, action) VALUES (?, ?)")
            ->execute([$key, $action]);
    }
}
