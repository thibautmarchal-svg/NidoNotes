<?php
require_once __DIR__ . '/core.php';

$user     = mustAuth();
$tid      = $user['id'];
$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id'])       ? (int)$_GET['id']       : 0;
$class_id = isset($_GET['class_id']) ? (int)$_GET['class_id'] : 0;

// GET — liste des périodes d'une classe
if ($method === 'GET') {
    if (!$class_id) err(400, 'class_id requis');
    mustOwnClass($tid, $class_id);
    $s = db()->prepare("SELECT id, class_id, name, order_num, created_at FROM nido_notes_periods WHERE class_id = ? AND teacher_id = ? ORDER BY order_num ASC, id ASC");
    $s->execute([$class_id, $tid]);
    ok($s->fetchAll());
}

// POST — créer une période
if ($method === 'POST') {
    $d        = input();
    $class_id = isset($d['class_id']) ? (int)$d['class_id'] : 0;
    $name     = isset($d['name'])     ? trim($d['name'])     : '';
    if (!$class_id || !$name) err(400, 'class_id et nom requis');
    mustOwnClass($tid, $class_id);

    // Ordre = max actuel + 1
    $s = db()->prepare("SELECT COALESCE(MAX(order_num),0)+1 AS next FROM nido_notes_periods WHERE class_id = ?");
    $s->execute([$class_id]);
    $order = (int)$s->fetchColumn();

    $ins = db()->prepare("INSERT INTO nido_notes_periods (teacher_id, class_id, name, order_num) VALUES (?, ?, ?, ?)");
    $ins->execute([$tid, $class_id, $name, $order]);
    $newId = (int)db()->lastInsertId();

    $s = db()->prepare("SELECT id, class_id, name, order_num, created_at FROM nido_notes_periods WHERE id = ?");
    $s->execute([$newId]);
    ok($s->fetch());
}

// PUT — modifier
if ($method === 'PUT') {
    if (!$id) err(400, 'ID requis');
    checkPeriodOwner($tid, $id);
    $d    = input();
    $name = isset($d['name']) ? trim($d['name']) : '';
    if (!$name) err(400, 'Nom requis');
    db()->prepare("UPDATE nido_notes_periods SET name = ? WHERE id = ? AND teacher_id = ?")
        ->execute([$name, $id, $tid]);
    ok(['id' => $id, 'name' => $name]);
}

// DELETE — supprimer (et mettre les évals à null ou bloquer si des évals existent)
if ($method === 'DELETE') {
    if (!$id) err(400, 'ID requis');
    checkPeriodOwner($tid, $id);

    // Vérifier si des évaluations existent pour cette période
    $s = db()->prepare("SELECT COUNT(*) FROM nido_notes_evaluations WHERE period_id = ? AND teacher_id = ?");
    $s->execute([$id, $tid]);
    if ((int)$s->fetchColumn() > 0) {
        err(409, 'Des évaluations existent pour cette période. Supprimez-les d\'abord.');
    }
    db()->prepare("DELETE FROM nido_notes_periods WHERE id = ? AND teacher_id = ?")->execute([$id, $tid]);
    ok(['ok' => true]);
}

err(405, 'Méthode non autorisée');

function checkPeriodOwner(int $teacherId, int $periodId): void
{
    $s = db()->prepare("SELECT id FROM nido_notes_periods WHERE id = ? AND teacher_id = ?");
    $s->execute([$periodId, $teacherId]);
    if (!$s->fetch()) err(403, 'Accès refusé');
}
