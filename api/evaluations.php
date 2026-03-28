<?php
require_once __DIR__ . '/core.php';

$user     = mustAuth();
$tid      = $user['id'];
$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id'])       ? (int)$_GET['id']       : 0;
$class_id = isset($_GET['class_id']) ? (int)$_GET['class_id'] : 0;

if ($method === 'GET') {
    if (!$class_id) err(400, 'class_id requis');
    mustOwnClass($tid, $class_id);
    $s = db()->prepare(
        "SELECT id, class_id, period_id, name, date, subject_id, sub_subject_id, weight, created_at
         FROM nido_notes_evaluations WHERE class_id = ? AND teacher_id = ? ORDER BY date ASC, name ASC"
    );
    $s->execute([$class_id, $tid]);
    $rows = $s->fetchAll();
    foreach ($rows as &$r) {
        $r['id']             = (int)$r['id'];
        $r['class_id']       = (int)$r['class_id'];
        $r['period_id']      = (int)$r['period_id'];
        $r['subject_id']     = (int)$r['subject_id'];
        $r['sub_subject_id'] = $r['sub_subject_id'] !== null ? (int)$r['sub_subject_id'] : null;
        $r['weight']         = (float)$r['weight'];
    }
    ok($rows);
}

if ($method === 'POST') {
    $d             = input();
    $class_id      = isset($d['class_id'])      ? (int)$d['class_id']      : 0;
    $period_id     = isset($d['period_id'])      ? (int)$d['period_id']     : 0;
    $name          = isset($d['name'])           ? trim($d['name'])          : '';
    $date          = isset($d['date'])           ? trim($d['date'])          : '';
    $subject_id    = isset($d['subject_id'])     ? (int)$d['subject_id']    : 0;
    $sub_subject_id = (isset($d['sub_subject_id']) && $d['sub_subject_id'] !== null) ? (int)$d['sub_subject_id'] : null;
    $weight        = isset($d['weight'])         ? (float)$d['weight']       : 1.0;
    if (!$class_id || !$period_id || !$name || !$date || !$subject_id) err(400, 'Champs requis manquants');
    mustOwnClass($tid, $class_id);

    db()->prepare(
        "INSERT INTO nido_notes_evaluations (teacher_id, class_id, period_id, name, date, subject_id, sub_subject_id, weight) VALUES (?,?,?,?,?,?,?,?)"
    )->execute([$tid, $class_id, $period_id, $name, $date, $subject_id, $sub_subject_id, $weight]);
    $newId = (int)db()->lastInsertId();

    $s = db()->prepare("SELECT id, class_id, period_id, name, date, subject_id, sub_subject_id, weight, created_at FROM nido_notes_evaluations WHERE id = ?");
    $s->execute([$newId]);
    $row = $s->fetch();
    $row['id']             = (int)$row['id'];
    $row['class_id']       = (int)$row['class_id'];
    $row['period_id']      = (int)$row['period_id'];
    $row['subject_id']     = (int)$row['subject_id'];
    $row['sub_subject_id'] = $row['sub_subject_id'] !== null ? (int)$row['sub_subject_id'] : null;
    $row['weight']         = (float)$row['weight'];
    ok($row);
}

if ($method === 'PUT') {
    if (!$id) err(400, 'ID requis');
    checkOwner($tid, $id);
    $d             = input();
    $period_id     = isset($d['period_id'])      ? (int)$d['period_id']     : 0;
    $name          = isset($d['name'])           ? trim($d['name'])          : '';
    $date          = isset($d['date'])           ? trim($d['date'])          : '';
    $subject_id    = isset($d['subject_id'])     ? (int)$d['subject_id']    : 0;
    $sub_subject_id = (isset($d['sub_subject_id']) && $d['sub_subject_id'] !== null) ? (int)$d['sub_subject_id'] : null;
    $weight        = isset($d['weight'])         ? (float)$d['weight']       : 1.0;
    if (!$period_id || !$name || !$date || !$subject_id) err(400, 'Champs requis manquants');
    db()->prepare(
        "UPDATE nido_notes_evaluations SET period_id=?, name=?, date=?, subject_id=?, sub_subject_id=?, weight=? WHERE id=? AND teacher_id=?"
    )->execute([$period_id, $name, $date, $subject_id, $sub_subject_id, $weight, $id, $tid]);
    ok(['id' => $id, 'period_id' => $period_id, 'name' => $name, 'date' => $date, 'subject_id' => $subject_id, 'sub_subject_id' => $sub_subject_id, 'weight' => $weight]);
}

if ($method === 'DELETE') {
    if (!$id) err(400, 'ID requis');
    checkOwner($tid, $id);
    db()->prepare("DELETE FROM nido_notes_grades WHERE evaluation_id = ? AND teacher_id = ?")->execute([$id, $tid]);
    db()->prepare("DELETE FROM nido_notes_evaluations WHERE id = ? AND teacher_id = ?")->execute([$id, $tid]);
    ok(['ok' => true]);
}

err(405, 'Méthode non autorisée');

function checkOwner(int $teacherId, int $evalId): void
{
    $s = db()->prepare("SELECT id FROM nido_notes_evaluations WHERE id = ? AND teacher_id = ?");
    $s->execute([$evalId, $teacherId]);
    if (!$s->fetch()) err(403, 'Accès refusé');
}
