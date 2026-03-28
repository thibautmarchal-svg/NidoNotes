<?php
require_once __DIR__ . '/core.php';

$user   = mustAuth();
$tid    = $user['id'];
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id'])     ? (int)$_GET['id']     : 0;
$action = isset($_GET['action']) ? $_GET['action']       : '';

// ── GET — liste des matières avec sous-matières ───────────────
if ($method === 'GET' && !$action) {
    $s = db()->prepare("SELECT id, name, created_at FROM nido_notes_subjects WHERE teacher_id = ? ORDER BY name ASC");
    $s->execute([$tid]);
    $subjects = $s->fetchAll();

    $ss = db()->prepare("SELECT id, subject_id, name, created_at FROM nido_notes_sub_subjects WHERE teacher_id = ? ORDER BY name ASC");
    $ss->execute([$tid]);
    $subs = $ss->fetchAll();

    // Indexer les sous-matières par subject_id
    $subMap = [];
    foreach ($subs as $sub) {
        $subMap[$sub['subject_id']][] = $sub;
    }
    foreach ($subjects as &$subj) {
        $subj['sub_subjects'] = isset($subMap[$subj['id']]) ? $subMap[$subj['id']] : [];
    }
    ok($subjects);
}

// ── POST — créer une matière ──────────────────────────────────
if ($method === 'POST' && !$action) {
    $d    = input();
    $name = isset($d['name']) ? trim($d['name']) : '';
    if (!$name) err(400, 'Nom requis');

    $ins = db()->prepare("INSERT INTO nido_notes_subjects (teacher_id, name) VALUES (?, ?)");
    $ins->execute([$tid, $name]);
    $newId = (int)db()->lastInsertId();

    $s = db()->prepare("SELECT id, name, created_at FROM nido_notes_subjects WHERE id = ?");
    $s->execute([$newId]);
    $subj = $s->fetch();
    $subj['sub_subjects'] = [];
    ok($subj);
}

// ── PUT — modifier une matière ────────────────────────────────
if ($method === 'PUT' && !$action) {
    if (!$id) err(400, 'ID requis');
    checkSubjectOwner($tid, $id);
    $d    = input();
    $name = isset($d['name']) ? trim($d['name']) : '';
    if (!$name) err(400, 'Nom requis');
    db()->prepare("UPDATE nido_notes_subjects SET name = ? WHERE id = ? AND teacher_id = ?")
        ->execute([$name, $id, $tid]);
    ok(['id' => $id, 'name' => $name]);
}

// ── DELETE — supprimer une matière ────────────────────────────
if ($method === 'DELETE' && !$action) {
    if (!$id) err(400, 'ID requis');
    checkSubjectOwner($tid, $id);
    // Récupère les sous-matières pour cascade
    $s = db()->prepare("SELECT id FROM nido_notes_sub_subjects WHERE subject_id = ? AND teacher_id = ?");
    $s->execute([$id, $tid]);
    $subIds = array_column($s->fetchAll(), 'id');
    if (!empty($subIds)) {
        $placeholders = implode(',', array_fill(0, count($subIds), '?'));
        // Met null sur les évaluations liées
        $params = array_merge($subIds, [$tid]);
        db()->prepare("UPDATE nido_notes_evaluations SET sub_subject_id = NULL WHERE sub_subject_id IN ({$placeholders}) AND teacher_id = ?")
            ->execute($params);
        db()->prepare("DELETE FROM nido_notes_sub_subjects WHERE subject_id = ? AND teacher_id = ?")
            ->execute([$id, $tid]);
    }
    // Supprime les évaluations de cette matière
    $s2 = db()->prepare("SELECT id FROM nido_notes_evaluations WHERE subject_id = ? AND teacher_id = ?");
    $s2->execute([$id, $tid]);
    $evalIds = array_column($s2->fetchAll(), 'id');
    if (!empty($evalIds)) {
        $placeholders = implode(',', array_fill(0, count($evalIds), '?'));
        $params = array_merge($evalIds, [$tid]);
        db()->prepare("DELETE FROM nido_notes_grades WHERE evaluation_id IN ({$placeholders}) AND teacher_id = ?")
            ->execute($params);
        db()->prepare("DELETE FROM nido_notes_evaluations WHERE subject_id = ? AND teacher_id = ?")
            ->execute([$id, $tid]);
    }
    db()->prepare("DELETE FROM nido_notes_subjects WHERE id = ? AND teacher_id = ?")
        ->execute([$id, $tid]);
    ok(['ok' => true]);
}

// ── POST sub_subject — créer une sous-matière ─────────────────
if ($method === 'POST' && $action === 'sub_subject') {
    $d          = input();
    $subject_id = isset($d['subject_id']) ? (int)$d['subject_id'] : 0;
    $name       = isset($d['name'])       ? trim($d['name'])       : '';
    if (!$subject_id || !$name) err(400, 'subject_id et nom requis');
    checkSubjectOwner($tid, $subject_id);

    $ins = db()->prepare("INSERT INTO nido_notes_sub_subjects (teacher_id, subject_id, name) VALUES (?, ?, ?)");
    $ins->execute([$tid, $subject_id, $name]);
    $newId = (int)db()->lastInsertId();

    $s = db()->prepare("SELECT id, subject_id, name, created_at FROM nido_notes_sub_subjects WHERE id = ?");
    $s->execute([$newId]);
    ok($s->fetch());
}

// ── PUT sub_subject — modifier une sous-matière ───────────────
if ($method === 'PUT' && $action === 'sub_subject') {
    if (!$id) err(400, 'ID requis');
    checkSubSubjectOwner($tid, $id);
    $d    = input();
    $name = isset($d['name']) ? trim($d['name']) : '';
    if (!$name) err(400, 'Nom requis');
    db()->prepare("UPDATE nido_notes_sub_subjects SET name = ? WHERE id = ? AND teacher_id = ?")
        ->execute([$name, $id, $tid]);
    ok(['id' => $id, 'name' => $name]);
}

// ── DELETE sub_subject — supprimer une sous-matière ───────────
if ($method === 'DELETE' && $action === 'sub_subject') {
    if (!$id) err(400, 'ID requis');
    checkSubSubjectOwner($tid, $id);
    // Relie les évaluations liées à null
    db()->prepare("UPDATE nido_notes_evaluations SET sub_subject_id = NULL WHERE sub_subject_id = ? AND teacher_id = ?")
        ->execute([$id, $tid]);
    db()->prepare("DELETE FROM nido_notes_sub_subjects WHERE id = ? AND teacher_id = ?")
        ->execute([$id, $tid]);
    ok(['ok' => true]);
}

err(405, 'Méthode non autorisée');

function checkSubjectOwner(int $teacherId, int $subjectId): void
{
    $s = db()->prepare("SELECT id FROM nido_notes_subjects WHERE id = ? AND teacher_id = ?");
    $s->execute([$subjectId, $teacherId]);
    if (!$s->fetch()) err(403, 'Accès refusé');
}

function checkSubSubjectOwner(int $teacherId, int $subId): void
{
    $s = db()->prepare("SELECT id FROM nido_notes_sub_subjects WHERE id = ? AND teacher_id = ?");
    $s->execute([$subId, $teacherId]);
    if (!$s->fetch()) err(403, 'Accès refusé');
}
