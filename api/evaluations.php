<?php
require_once __DIR__ . '/core.php';

$user   = mustAuth();
$tid    = $user['id'];
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// ── GET — liste ───────────────────────────────────────────────
if ($method === 'GET') {
    $s = db()->prepare(
        "SELECT id, name, date, subject_id, sub_subject_id, weight, created_at
         FROM nido_notes_evaluations
         WHERE teacher_id = ?
         ORDER BY date ASC, name ASC"
    );
    $s->execute([$tid]);
    $rows = $s->fetchAll();
    // Cast types
    foreach ($rows as &$r) {
        $r['id']             = (int)$r['id'];
        $r['subject_id']     = (int)$r['subject_id'];
        $r['sub_subject_id'] = $r['sub_subject_id'] !== null ? (int)$r['sub_subject_id'] : null;
        $r['weight']         = (float)$r['weight'];
    }
    ok($rows);
}

// ── POST — créer ──────────────────────────────────────────────
if ($method === 'POST') {
    $d             = input();
    $name          = isset($d['name'])          ? trim($d['name'])          : '';
    $date          = isset($d['date'])          ? trim($d['date'])          : '';
    $subject_id    = isset($d['subject_id'])    ? (int)$d['subject_id']    : 0;
    $sub_subject_id = isset($d['sub_subject_id']) && $d['sub_subject_id'] !== null ? (int)$d['sub_subject_id'] : null;
    $weight        = isset($d['weight'])        ? (float)$d['weight']       : 1.0;
    if (!$name || !$date || !$subject_id) err(400, 'Nom, date et matière requis');
    if (!checkDateFormat($date)) err(400, 'Format de date invalide (YYYY-MM-DD)');

    $ins = db()->prepare(
        "INSERT INTO nido_notes_evaluations (teacher_id, name, date, subject_id, sub_subject_id, weight)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $ins->execute([$tid, $name, $date, $subject_id, $sub_subject_id, $weight]);
    $newId = (int)db()->lastInsertId();

    $s = db()->prepare("SELECT id, name, date, subject_id, sub_subject_id, weight, created_at FROM nido_notes_evaluations WHERE id = ?");
    $s->execute([$newId]);
    $row = $s->fetch();
    $row['id']             = (int)$row['id'];
    $row['subject_id']     = (int)$row['subject_id'];
    $row['sub_subject_id'] = $row['sub_subject_id'] !== null ? (int)$row['sub_subject_id'] : null;
    $row['weight']         = (float)$row['weight'];
    ok($row);
}

// ── PUT — modifier ────────────────────────────────────────────
if ($method === 'PUT') {
    if (!$id) err(400, 'ID requis');
    checkOwner($tid, $id);
    $d             = input();
    $name          = isset($d['name'])          ? trim($d['name'])          : '';
    $date          = isset($d['date'])          ? trim($d['date'])          : '';
    $subject_id    = isset($d['subject_id'])    ? (int)$d['subject_id']    : 0;
    $sub_subject_id = isset($d['sub_subject_id']) && $d['sub_subject_id'] !== null ? (int)$d['sub_subject_id'] : null;
    $weight        = isset($d['weight'])        ? (float)$d['weight']       : 1.0;
    if (!$name || !$date || !$subject_id) err(400, 'Nom, date et matière requis');
    if (!checkDateFormat($date)) err(400, 'Format de date invalide');

    db()->prepare(
        "UPDATE nido_notes_evaluations SET name = ?, date = ?, subject_id = ?, sub_subject_id = ?, weight = ?
         WHERE id = ? AND teacher_id = ?"
    )->execute([$name, $date, $subject_id, $sub_subject_id, $weight, $id, $tid]);
    ok(['id' => $id, 'name' => $name, 'date' => $date, 'subject_id' => $subject_id, 'sub_subject_id' => $sub_subject_id, 'weight' => $weight]);
}

// ── DELETE — supprimer ────────────────────────────────────────
if ($method === 'DELETE') {
    if (!$id) err(400, 'ID requis');
    checkOwner($tid, $id);
    db()->prepare("DELETE FROM nido_notes_grades WHERE evaluation_id = ? AND teacher_id = ?")
        ->execute([$id, $tid]);
    db()->prepare("DELETE FROM nido_notes_evaluations WHERE id = ? AND teacher_id = ?")
        ->execute([$id, $tid]);
    ok(['ok' => true]);
}

err(405, 'Méthode non autorisée');

function checkOwner(int $teacherId, int $evalId): void
{
    $s = db()->prepare("SELECT id FROM nido_notes_evaluations WHERE id = ? AND teacher_id = ?");
    $s->execute([$evalId, $teacherId]);
    if (!$s->fetch()) err(403, 'Accès refusé');
}

function checkDateFormat(string $date): bool
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return false;
    $parts = explode('-', $date);
    return checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0]);
}
