<?php
require_once __DIR__ . '/core.php';

$user     = mustAuth();
$tid      = $user['id'];
$method   = $_SERVER['REQUEST_METHOD'];
$class_id = isset($_GET['class_id']) ? (int)$_GET['class_id'] : 0;

// GET — toutes les notes d'une classe
if ($method === 'GET') {
    if (!$class_id) err(400, 'class_id requis');
    mustOwnClass($tid, $class_id);
    // Récupère via les évaluations de la classe
    $s = db()->prepare(
        "SELECT g.student_id, g.evaluation_id, g.score, g.is_absent, g.comment, g.updated_at
         FROM nido_notes_grades g
         INNER JOIN nido_notes_evaluations e ON e.id = g.evaluation_id
         WHERE e.class_id = ? AND g.teacher_id = ?
         ORDER BY g.updated_at ASC"
    );
    $s->execute([$class_id, $tid]);
    $rows = $s->fetchAll();
    foreach ($rows as &$r) {
        $r['student_id']    = (int)$r['student_id'];
        $r['evaluation_id'] = (int)$r['evaluation_id'];
        $r['score']         = $r['score'] !== null ? (float)$r['score'] : null;
        $r['is_absent']     = (bool)$r['is_absent'];
    }
    ok($rows);
}

// POST — upsert une note
if ($method === 'POST') {
    $d             = input();
    $student_id    = isset($d['student_id'])    ? (int)$d['student_id']    : 0;
    $evaluation_id = isset($d['evaluation_id']) ? (int)$d['evaluation_id'] : 0;
    $score         = (isset($d['score']) && $d['score'] !== null && $d['score'] !== '') ? (float)$d['score'] : null;
    $is_absent     = !empty($d['is_absent']) ? 1 : 0;
    $comment       = isset($d['comment']) ? trim($d['comment']) : null;
    if (!$student_id || !$evaluation_id) err(400, 'student_id et evaluation_id requis');
    if ($score !== null && ($score < 0 || $score > 10)) err(400, 'Note entre 0 et 10');

    // Vérifier appartenance
    $s1 = db()->prepare("SELECT id FROM nido_notes_students WHERE id = ? AND teacher_id = ?");
    $s1->execute([$student_id, $tid]);
    if (!$s1->fetch()) err(403, 'Élève non autorisé');
    $s2 = db()->prepare("SELECT id FROM nido_notes_evaluations WHERE id = ? AND teacher_id = ?");
    $s2->execute([$evaluation_id, $tid]);
    if (!$s2->fetch()) err(403, 'Évaluation non autorisée');

    db()->prepare(
        "INSERT INTO nido_notes_grades (teacher_id, student_id, evaluation_id, score, is_absent, comment)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score=VALUES(score), is_absent=VALUES(is_absent), comment=VALUES(comment), updated_at=CURRENT_TIMESTAMP"
    )->execute([$tid, $student_id, $evaluation_id, $score, $is_absent, $comment ?: null]);

    $s = db()->prepare("SELECT student_id, evaluation_id, score, is_absent, comment, updated_at FROM nido_notes_grades WHERE student_id=? AND evaluation_id=?");
    $s->execute([$student_id, $evaluation_id]);
    $row = $s->fetch();
    $row['student_id']    = (int)$row['student_id'];
    $row['evaluation_id'] = (int)$row['evaluation_id'];
    $row['score']         = $row['score'] !== null ? (float)$row['score'] : null;
    $row['is_absent']     = (bool)$row['is_absent'];
    ok($row);
}

err(405, 'Méthode non autorisée');
