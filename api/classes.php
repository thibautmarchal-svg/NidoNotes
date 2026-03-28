<?php
require_once __DIR__ . '/core.php';

$user   = mustAuth();
$tid    = $user['id'];
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// GET — liste des classes
if ($method === 'GET') {
    $s = db()->prepare("SELECT id, name, school_year, created_at FROM nido_notes_classes WHERE teacher_id = ? ORDER BY school_year DESC, name ASC");
    $s->execute([$tid]);
    ok($s->fetchAll());
}

// POST — créer une classe
if ($method === 'POST') {
    $d           = input();
    $name        = isset($d['name'])        ? trim($d['name'])        : '';
    $school_year = isset($d['school_year']) ? trim($d['school_year']) : null;
    if (!$name) err(400, 'Nom de classe requis');

    $ins = db()->prepare("INSERT INTO nido_notes_classes (teacher_id, name, school_year) VALUES (?, ?, ?)");
    $ins->execute([$tid, $name, $school_year ?: null]);
    $newId = (int)db()->lastInsertId();

    $s = db()->prepare("SELECT id, name, school_year, created_at FROM nido_notes_classes WHERE id = ?");
    $s->execute([$newId]);
    ok($s->fetch());
}

// PUT — modifier
if ($method === 'PUT') {
    if (!$id) err(400, 'ID requis');
    mustOwnClass($tid, $id);
    $d           = input();
    $name        = isset($d['name'])        ? trim($d['name'])        : '';
    $school_year = isset($d['school_year']) ? trim($d['school_year']) : null;
    if (!$name) err(400, 'Nom requis');
    db()->prepare("UPDATE nido_notes_classes SET name = ?, school_year = ? WHERE id = ? AND teacher_id = ?")
        ->execute([$name, $school_year ?: null, $id, $tid]);
    ok(['id' => $id, 'name' => $name, 'school_year' => $school_year]);
}

// DELETE — supprimer (cascade)
if ($method === 'DELETE') {
    if (!$id) err(400, 'ID requis');
    mustOwnClass($tid, $id);
    $pdo = db();

    // Récupère les évaluations pour supprimer les notes
    $evals = $pdo->prepare("SELECT id FROM nido_notes_evaluations WHERE class_id = ? AND teacher_id = ?");
    $evals->execute([$id, $tid]);
    $evalIds = array_column($evals->fetchAll(), 'id');
    if (!empty($evalIds)) {
        $ph = implode(',', array_fill(0, count($evalIds), '?'));
        $pdo->prepare("DELETE FROM nido_notes_grades WHERE evaluation_id IN ({$ph})")->execute($evalIds);
    }

    // Récupère les matières pour supprimer les sous-matières
    $subjs = $pdo->prepare("SELECT id FROM nido_notes_subjects WHERE class_id = ? AND teacher_id = ?");
    $subjs->execute([$id, $tid]);
    $subjIds = array_column($subjs->fetchAll(), 'id');
    if (!empty($subjIds)) {
        $ph = implode(',', array_fill(0, count($subjIds), '?'));
        $pdo->prepare("DELETE FROM nido_notes_sub_subjects WHERE subject_id IN ({$ph})")->execute($subjIds);
    }

    $pdo->prepare("DELETE FROM nido_notes_evaluations WHERE class_id = ? AND teacher_id = ?")->execute([$id, $tid]);
    $pdo->prepare("DELETE FROM nido_notes_subjects WHERE class_id = ? AND teacher_id = ?")->execute([$id, $tid]);
    $pdo->prepare("DELETE FROM nido_notes_students WHERE class_id = ? AND teacher_id = ?")->execute([$id, $tid]);
    $pdo->prepare("DELETE FROM nido_notes_periods WHERE class_id = ? AND teacher_id = ?")->execute([$id, $tid]);
    $pdo->prepare("DELETE FROM nido_notes_classes WHERE id = ? AND teacher_id = ?")->execute([$id, $tid]);
    ok(['ok' => true]);
}

err(405, 'Méthode non autorisée');
