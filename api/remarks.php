<?php
require_once __DIR__ . '/core.php';

// Créer la table si elle n'existe pas
db()->exec("
    CREATE TABLE IF NOT EXISTS nido_notes_remarks (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        class_id   INT NOT NULL,
        student_id INT NOT NULL,
        period_id  INT NOT NULL,
        content    TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_remark (teacher_id, class_id, student_id, period_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$user      = mustAuth();
$tid       = $user['id'];
$method    = $_SERVER['REQUEST_METHOD'];
$class_id  = isset($_GET['class_id'])  ? (int)$_GET['class_id']  : 0;
$student_id = isset($_GET['student_id']) ? (int)$_GET['student_id'] : 0;
$period_id  = isset($_GET['period_id'])  ? (int)$_GET['period_id']  : 0;

// GET — liste des remarques d'une classe (toutes périodes, tous élèves)
if ($method === 'GET') {
    if (!$class_id) err(400, 'class_id requis');
    mustOwnClass($tid, $class_id);
    $s = db()->prepare("SELECT id, class_id, student_id, period_id, content, updated_at FROM nido_notes_remarks WHERE class_id = ? AND teacher_id = ?");
    $s->execute([$class_id, $tid]);
    ok($s->fetchAll());
}

// POST — créer ou mettre à jour une remarque (upsert)
if ($method === 'POST') {
    $d          = input();
    $class_id   = isset($d['class_id'])   ? (int)$d['class_id']   : 0;
    $student_id = isset($d['student_id']) ? (int)$d['student_id'] : 0;
    $period_id  = isset($d['period_id'])  ? (int)$d['period_id']  : 0;
    $content    = isset($d['content'])    ? trim($d['content'])    : '';

    if (!$class_id || !$student_id || !$period_id) err(400, 'class_id, student_id et period_id requis');
    mustOwnClass($tid, $class_id);

    $s = db()->prepare("
        INSERT INTO nido_notes_remarks (teacher_id, class_id, student_id, period_id, content)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE content = VALUES(content)
    ");
    $s->execute([$tid, $class_id, $student_id, $period_id, $content]);

    $s = db()->prepare("SELECT id, class_id, student_id, period_id, content, updated_at FROM nido_notes_remarks WHERE teacher_id = ? AND class_id = ? AND student_id = ? AND period_id = ?");
    $s->execute([$tid, $class_id, $student_id, $period_id]);
    ok($s->fetch());
}

err(405, 'Méthode non autorisée');
