<?php
require_once __DIR__ . '/core.php';
$user = mustAuth();
$tid    = (int)$user['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (isset($_GET['evaluation_id'])) {
        $evalId = (int)$_GET['evaluation_id'];
        $s = db()->prepare("SELECT id FROM nido_notes_evaluations WHERE id = ? AND teacher_id = ?");
        $s->execute([$evalId, $tid]);
        if (!$s->fetch()) err(403, 'Accès refusé');
        $s = db()->prepare("SELECT id, evaluation_id, name, created_at FROM nido_notes_objectives WHERE evaluation_id = ? AND teacher_id = ? ORDER BY id");
        $s->execute([$evalId, $tid]);
        ok($s->fetchAll());
    }
    if (isset($_GET['class_id'])) {
        $classId = (int)$_GET['class_id'];
        mustOwnClass($tid, $classId);
        $s = db()->prepare("
            SELECT o.id, o.name, o.evaluation_id, o.created_at,
                   e.subject_id, e.sub_subject_id, e.name AS eval_name, e.period_id, e.class_id
            FROM nido_notes_objectives o
            JOIN nido_notes_evaluations e ON e.id = o.evaluation_id
            WHERE e.class_id = ? AND o.teacher_id = ?
            ORDER BY e.subject_id, e.sub_subject_id, o.id
        ");
        $s->execute([$classId, $tid]);
        ok($s->fetchAll());
    }
    err(400, 'Paramètre manquant');
}

if ($method === 'POST') {
    $b      = input();
    $evalId = (int)($b['evaluation_id'] ?? 0);
    $name   = trim($b['name'] ?? '');
    if (!$evalId || $name === '') err(400, 'Données manquantes');
    $s = db()->prepare("SELECT id FROM nido_notes_evaluations WHERE id = ? AND teacher_id = ?");
    $s->execute([$evalId, $tid]);
    if (!$s->fetch()) err(403, 'Accès refusé');
    $s = db()->prepare("INSERT INTO nido_notes_objectives (teacher_id, evaluation_id, name) VALUES (?, ?, ?)");
    $s->execute([$tid, $evalId, $name]);
    $newId = (int)db()->lastInsertId();
    ok(['id' => $newId, 'teacher_id' => $tid, 'evaluation_id' => $evalId, 'name' => $name]);
}

if ($method === 'DELETE') {
    if (isset($_GET['evaluation_id'])) {
        $evalId = (int)$_GET['evaluation_id'];
        $s = db()->prepare("SELECT id FROM nido_notes_evaluations WHERE id = ? AND teacher_id = ?");
        $s->execute([$evalId, $tid]);
        if (!$s->fetch()) err(403, 'Accès refusé');
        db()->prepare("DELETE FROM nido_notes_objectives WHERE evaluation_id = ? AND teacher_id = ?")->execute([$evalId, $tid]);
        ok(['ok' => true]);
    }
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) err(400, 'ID manquant');
    db()->prepare("DELETE FROM nido_notes_objectives WHERE id = ? AND teacher_id = ?")->execute([$id, $tid]);
    ok(['ok' => true]);
}

err(405, 'Méthode non supportée');
