<?php
require_once __DIR__ . '/core.php';

$user   = mustAuth();
$tid    = $user['id'];
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — toutes les notes de l'enseignant ────────────────────
if ($method === 'GET') {
    $since = isset($_GET['since']) ? trim($_GET['since']) : '';
    if ($since) {
        $s = db()->prepare(
            "SELECT id, student_id, evaluation_id, score, is_absent, comment, updated_at
             FROM nido_notes_grades WHERE teacher_id = ? AND updated_at > ?
             ORDER BY updated_at ASC"
        );
        $s->execute([$tid, $since]);
    } else {
        $s = db()->prepare(
            "SELECT id, student_id, evaluation_id, score, is_absent, comment, updated_at
             FROM nido_notes_grades WHERE teacher_id = ?
             ORDER BY updated_at ASC"
        );
        $s->execute([$tid]);
    }
    $rows = $s->fetchAll();
    foreach ($rows as &$r) {
        $r['id']            = (int)$r['id'];
        $r['student_id']    = (int)$r['student_id'];
        $r['evaluation_id'] = (int)$r['evaluation_id'];
        $r['score']         = $r['score'] !== null ? (float)$r['score'] : null;
        $r['is_absent']     = (bool)$r['is_absent'];
    }
    ok($rows);
}

// ── POST — sauvegarder une note (upsert) ──────────────────────
if ($method === 'POST') {
    $d             = input();
    $student_id    = isset($d['student_id'])    ? (int)$d['student_id']    : 0;
    $evaluation_id = isset($d['evaluation_id']) ? (int)$d['evaluation_id'] : 0;
    $score         = isset($d['score']) && $d['score'] !== null && $d['score'] !== '' ? (float)$d['score'] : null;
    $is_absent     = !empty($d['is_absent']) ? 1 : 0;
    $comment       = isset($d['comment']) ? trim($d['comment']) : null;
    if (!$student_id || !$evaluation_id) err(400, 'student_id et evaluation_id requis');
    if ($score !== null && ($score < 0 || $score > 10)) err(400, 'Note entre 0 et 10');

    // Vérifier que l'élève et l'évaluation appartiennent à l'enseignant
    $s1 = db()->prepare("SELECT id FROM nido_notes_students WHERE id = ? AND teacher_id = ?");
    $s1->execute([$student_id, $tid]);
    if (!$s1->fetch()) err(403, 'Élève non autorisé');

    $s2 = db()->prepare("SELECT id FROM nido_notes_evaluations WHERE id = ? AND teacher_id = ?");
    $s2->execute([$evaluation_id, $tid]);
    if (!$s2->fetch()) err(403, 'Évaluation non autorisée');

    // UPSERT
    $pdo = db();
    $pdo->prepare(
        "INSERT INTO nido_notes_grades (teacher_id, student_id, evaluation_id, score, is_absent, comment)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score), is_absent = VALUES(is_absent), comment = VALUES(comment), updated_at = CURRENT_TIMESTAMP"
    )->execute([$tid, $student_id, $evaluation_id, $score, $is_absent, $comment ?: null]);

    $s = $pdo->prepare(
        "SELECT id, student_id, evaluation_id, score, is_absent, comment, updated_at
         FROM nido_notes_grades WHERE student_id = ? AND evaluation_id = ?"
    );
    $s->execute([$student_id, $evaluation_id]);
    $row = $s->fetch();
    $row['id']            = (int)$row['id'];
    $row['student_id']    = (int)$row['student_id'];
    $row['evaluation_id'] = (int)$row['evaluation_id'];
    $row['score']         = $row['score'] !== null ? (float)$row['score'] : null;
    $row['is_absent']     = (bool)$row['is_absent'];
    ok($row);
}

// ── POST bulk — sauvegarder plusieurs notes d'un coup ─────────
if ($method === 'PUT') {
    // bulk update: body = array of grade objects
    $grades = input();
    if (!is_array($grades)) err(400, 'Tableau de notes attendu');
    $results = [];
    foreach ($grades as $d) {
        $student_id    = isset($d['student_id'])    ? (int)$d['student_id']    : 0;
        $evaluation_id = isset($d['evaluation_id']) ? (int)$d['evaluation_id'] : 0;
        $score         = isset($d['score']) && $d['score'] !== null && $d['score'] !== '' ? (float)$d['score'] : null;
        $is_absent     = !empty($d['is_absent']) ? 1 : 0;
        $comment       = isset($d['comment']) ? trim($d['comment']) : null;
        if (!$student_id || !$evaluation_id) continue;

        db()->prepare(
            "INSERT INTO nido_notes_grades (teacher_id, student_id, evaluation_id, score, is_absent, comment)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE score = VALUES(score), is_absent = VALUES(is_absent), comment = VALUES(comment), updated_at = CURRENT_TIMESTAMP"
        )->execute([$tid, $student_id, $evaluation_id, $score, $is_absent, $comment ?: null]);

        $results[] = ['student_id' => $student_id, 'evaluation_id' => $evaluation_id];
    }
    ok(['saved' => count($results)]);
}

err(405, 'Méthode non autorisée');
