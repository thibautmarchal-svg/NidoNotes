<?php
require_once __DIR__ . '/core.php';

$user   = mustAuth();
$tid    = $user['id'];
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// ── GET — liste ───────────────────────────────────────────────
if ($method === 'GET') {
    $s = db()->prepare("SELECT id, first_name, last_name, created_at FROM nido_notes_students WHERE teacher_id = ? ORDER BY last_name ASC, first_name ASC");
    $s->execute([$tid]);
    ok($s->fetchAll());
}

// ── POST — créer ──────────────────────────────────────────────
if ($method === 'POST') {
    $d          = input();
    $first_name = isset($d['first_name']) ? trim($d['first_name']) : '';
    $last_name  = isset($d['last_name'])  ? trim($d['last_name'])  : '';
    if (!$first_name || !$last_name) err(400, 'Prénom et nom requis');

    $ins = db()->prepare("INSERT INTO nido_notes_students (teacher_id, first_name, last_name) VALUES (?, ?, ?)");
    $ins->execute([$tid, $first_name, $last_name]);
    $newId = (int)db()->lastInsertId();

    $s = db()->prepare("SELECT id, first_name, last_name, created_at FROM nido_notes_students WHERE id = ?");
    $s->execute([$newId]);
    ok($s->fetch());
}

// ── PUT — modifier ────────────────────────────────────────────
if ($method === 'PUT') {
    if (!$id) err(400, 'ID requis');
    checkOwnership($tid, $id);
    $d          = input();
    $first_name = isset($d['first_name']) ? trim($d['first_name']) : '';
    $last_name  = isset($d['last_name'])  ? trim($d['last_name'])  : '';
    if (!$first_name || !$last_name) err(400, 'Prénom et nom requis');

    db()->prepare("UPDATE nido_notes_students SET first_name = ?, last_name = ? WHERE id = ? AND teacher_id = ?")
        ->execute([$first_name, $last_name, $id, $tid]);
    ok(['id' => $id, 'first_name' => $first_name, 'last_name' => $last_name]);
}

// ── DELETE — supprimer ────────────────────────────────────────
if ($method === 'DELETE') {
    if (!$id) err(400, 'ID requis');
    checkOwnership($tid, $id);
    // Supprime aussi les notes de cet élève
    db()->prepare("DELETE FROM nido_notes_grades WHERE student_id = ? AND teacher_id = ?")
        ->execute([$id, $tid]);
    db()->prepare("DELETE FROM nido_notes_students WHERE id = ? AND teacher_id = ?")
        ->execute([$id, $tid]);
    ok(['ok' => true]);
}

err(405, 'Méthode non autorisée');

function checkOwnership(int $teacherId, int $studentId): void
{
    $s = db()->prepare("SELECT id FROM nido_notes_students WHERE id = ? AND teacher_id = ?");
    $s->execute([$studentId, $teacherId]);
    if (!$s->fetch()) err(403, 'Accès refusé');
}
