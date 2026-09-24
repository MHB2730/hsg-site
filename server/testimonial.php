<?php
/* =====================================================================
 * testimonial.php — receives a client testimonial from /testimonials/ and
 * holds it for review. Nothing submitted here is ever published directly.
 *
 * Every accepted submission is:
 *   1. appended to testimonials.log.jsonl (the full record, email and IP
 *      included) BEFORE anything else, so a later failure never loses it;
 *   2. added to the site's GitHub repository as
 *      content/testimonials/<id>.json with "status": "pending" — the
 *      publishable fields only, never the email address or IP — where it
 *      appears in the admin (/admin) under Testimonials for review;
 *   3. announced by email to the firm, with the address to confirm it by.
 *
 * It becomes public only when someone marks it "published" in the admin,
 * which rebuilds the site. The commit made here carries [skip ci]: a pending
 * testimonial changes nothing on the site, so there is nothing to rebuild.
 *
 * Needs, in mail-config.php on the server (see mail-config.example.php):
 *   'github' => ['token' => ..., 'repo' => 'owner/name', 'branch' => 'main'],
 *   'testimonials_to' => 'mailbox@...'   (optional; falls back to 'to')
 * Without the github block, step 2 is skipped and the email says so.
 * ===================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$hasConfig = is_file(__DIR__ . '/mail-config.php');
if ($hasConfig) { require_once __DIR__ . '/hsg-mail.php'; }
$cfg = $hasConfig ? hsg_mail_config() : [];

function t_fail(int $code, string $error): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $error]);
    exit;
}
function t_errlog(string $what): void {
    @file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . 'testimonial-errors.log',
        gmdate('c') . ' ' . str_replace(["\r", "\n"], ' | ', $what) . "\n", FILE_APPEND | LOCK_EX);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { t_fail(405, 'Method not allowed'); }

$raw = file_get_contents('php://input');
if (strlen((string)$raw) > 20000) { t_fail(413, 'Payload too large'); }
$data = json_decode((string)$raw, true);
$isJson = is_array($data);
if (!$isJson) { $data = $_POST; }

/* Honeypot: logged, not discarded, so a false positive can be rescued. */
$honeypot = is_array($data['hsg_leave_blank'] ?? '') ? '' : trim((string)($data['hsg_leave_blank'] ?? ''));
if ($honeypot !== '') {
    $line = json_encode([
        'timestamp' => gmdate('c'),
        'form'      => 'testimonial',
        'ip'        => (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        'honeypot'  => mb_substr($honeypot, 0, 100),
        'name'      => mb_substr((string)($data['name'] ?? ''), 0, 100),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line !== false) { @file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . 'honeypot.log.jsonl', $line . "\n", FILE_APPEND | LOCK_EX); }
    echo json_encode(['success' => true]);
    exit;
}

/* ---- read and check the fields ---- */
$field = function ($s, int $max): string { return is_array($s) ? '' : mb_substr(trim(preg_replace('/\s+/u', ' ', strip_tags((string)$s))), 0, $max); };
$name  = $field($data['name'] ?? '', 100);
$email = $field($data['email'] ?? '', 120);
$role  = $field($data['role'] ?? '', 80);
$org   = $field($data['organisation'] ?? '', 100);
$matter = $field($data['matter'] ?? '', 80);
$display = in_array($data['display'] ?? '', ['full', 'initials', 'anonymous'], true) ? $data['display'] : 'full';
$rating = filter_var($data['rating'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
$rating = $rating === false ? null : $rating;
// The testimonial keeps its paragraph breaks but nothing else from outside.
$quote = is_array($data['quote'] ?? '') ? '' : trim(preg_replace("/\n{3,}/", "\n\n", str_replace(["\r\n", "\r"], "\n", strip_tags((string)($data['quote'] ?? '')))));
$quote = mb_substr($quote, 0, 1200);
$consent = filter_var($data['consent'] ?? false, FILTER_VALIDATE_BOOLEAN) || (($data['consent'] ?? '') === 'yes');

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($quote) < 30 || !$consent) {
    if (!$isJson) { header('Location: /testimonials/?sent=0#share', true, 303); exit; }
    t_fail(422, 'Invalid input');
}

/* ---- rate limits: a few per visitor per hour, and a ceiling for the whole site per day ---- */
function t_throttle(string $key, int $max, int $window): bool {
    $now = time();
    try {
        $fh = @fopen(sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'hsgtst_' . hash('sha256', $key), 'c+');
        if ($fh === false || !@flock($fh, LOCK_EX)) { return true; }   // fail open
        $stamps = array_values(array_filter(array_map('intval', explode(',', trim((string)stream_get_contents($fh)))),
            fn ($t) => $t > 0 && ($now - $t) < $window));
        if (count($stamps) >= $max) { @flock($fh, LOCK_UN); @fclose($fh); return false; }
        $stamps[] = $now;
        @ftruncate($fh, 0); @rewind($fh); @fwrite($fh, implode(',', $stamps)); @fflush($fh);
        @flock($fh, LOCK_UN); @fclose($fh);
    } catch (Throwable $e) { /* fail open */ }
    return true;
}
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!t_throttle('ip:' . $ip, 3, 3600) || !t_throttle('site', 40, 86400)) {
    if (!$isJson) { header('Location: /testimonials/?sent=0#share', true, 303); exit; }
    t_fail(429, 'Too many requests');
}

/* ---- 1. the full record, first ---- */
$slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(@iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name) ?: 'client')), '-');
$id = gmdate('Y-m-d') . '-' . (substr($slug, 0, 40) ?: 'client') . '-' . bin2hex(random_bytes(3));
$submitted = gmdate('c');
$logged = @file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . 'testimonials.log.jsonl', json_encode([
    'id' => $id, 'timestamp' => $submitted, 'ip' => $ip,
    'ua' => mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200),
    'name' => $name, 'email' => $email, 'display' => $display, 'role' => $role, 'organisation' => $org,
    'matter' => $matter, 'rating' => $rating, 'quote' => $quote, 'consent' => true, 'consent_ts' => $submitted,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX) !== false;
if (!$logged) { t_errlog("$id: could not write testimonials.log.jsonl"); }

/* ---- 2. into the admin's review queue ---- */
$entry = array_filter([
    'status' => 'pending', 'source' => 'website', 'submitted' => $submitted,
    'name' => $name, 'display' => $display, 'role' => $role, 'organisation' => $org, 'matter' => $matter,
    'rating' => $rating, 'date' => gmdate('Y-m'), 'quote' => $quote, 'consent' => true,
], fn ($v) => $v !== '' && $v !== null);
$gh = is_array($cfg['github'] ?? null) ? $cfg['github'] : [];
$queued = false; $queueNote = 'no GitHub settings in mail-config.php';
if (!empty($gh['token']) && !empty($gh['repo'])) {
    $url = 'https://api.github.com/repos/' . $gh['repo'] . '/contents/content/testimonials/' . $id . '.json';
    $payload = json_encode([
        'message' => 'New testimonial awaiting review [skip ci]',
        'content' => base64_encode(json_encode($entry, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"),
        'branch'  => (string)($gh['branch'] ?? 'main'),
    ]);
    $headers = ['Accept: application/vnd.github+json', 'Authorization: Bearer ' . $gh['token'], 'X-GitHub-Api-Version: 2022-11-28',
                'User-Agent: hsgattorneys-website', 'Content-Type: application/json'];
    $code = 0; $resp = '';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => 'PUT', CURLOPT_POSTFIELDS => $payload, CURLOPT_HTTPHEADER => $headers,
                                CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 20]);
        $resp = (string)curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($code === 0) { $resp = curl_error($ch); }
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['method' => 'PUT', 'header' => implode("\r\n", $headers), 'content' => $payload,
                                                 'timeout' => 20, 'ignore_errors' => true]]);
        $resp = (string)@file_get_contents($url, false, $ctx);
        $status = function_exists('http_get_last_response_headers') ? (http_get_last_response_headers() ?? []) : ($http_response_header ?? []);
        if (isset($status[0]) && preg_match('#\s(\d{3})\s#', $status[0], $m)) { $code = (int)$m[1]; }
    }
    $queued = $code === 201 || $code === 200;
    // The token is never written anywhere; only the status and GitHub's own message.
    $queueNote = $queued ? 'added' : "GitHub answered $code: " . mb_substr($resp, 0, 240);
    if (!$queued) { t_errlog("$id: $queueNote"); }
}

/* ---- 3. tell the firm ---- */
$mailed = false;
if ($hasConfig) {
    $site = 'https://hsgattorneys.co.za';
    $shown = $display === 'initials' ? 'initials only' : ($display === 'anonymous' ? 'not at all ("Private client")' : 'in full');
    $lines = [
        'A client has sent a testimonial through hsgattorneys.co.za. It is NOT published.',
        '',
        'Name:          ' . $name . '  (to be shown ' . $shown . ')',
        'Email:         ' . $email . '  (never published — use it to confirm the testimonial is theirs)',
        'Role:          ' . ($role !== '' ? $role : '—'),
        'Organisation:  ' . ($org !== '' ? $org : '—'),
        'Matter:        ' . ($matter !== '' ? $matter : '—'),
        'Rating:        ' . ($rating !== null ? $rating . ' of 5' : '—'),
        '',
        'Testimonial:',
        $quote,
        '',
        '—',
        $queued
            ? "It is waiting in the admin under Testimonials, marked Pending:\n$site/admin/#/collections/testimonials\nSet its status to Published to put it on the website."
            : "It could NOT be added to the admin automatically ($queueNote).\nIt is in testimonials.log.jsonl on the server, and above; add it in the admin by hand if it should be published.",
        '',
        'Consent to publish, with the name shown as chosen above, was given at ' . $submitted . ' from ' . $ip . '.',
    ];
    $fromHeader = (string)($cfg['from'] ?? 'HSG Website <webmaster@hsgattorneys.co.za>');
    $to = (string)($cfg['testimonials_to'] ?? $cfg['to'] ?? '');
    $headersMail = implode("\r\n", [
        'From: ' . $fromHeader,
        'Reply-To: ' . mb_encode_mimeheader($name, 'UTF-8', 'B') . ' <' . $email . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-HSG-Source: website-testimonial',
    ]);
    if ($to !== '') {
        [$mailed, $log] = hsg_smtp_send($to, mb_encode_mimeheader('Testimonial for review — ' . $name, 'UTF-8', 'B'),
            implode("\r\n", $lines), $headersMail, $fromHeader);
        if (!$mailed) { t_errlog("$id: email failed: $log"); }
    }
} else {
    t_errlog("$id: mail-config.php is missing, so nothing was sent or queued");
}

/* It counts as received if it was kept anywhere; otherwise the client should try again. */
$ok = $logged || $queued || $mailed;
if (!$isJson) { header('Location: /testimonials/?sent=' . ($ok ? '1' : '0') . '#share', true, 303); exit; }
if (!$ok) { http_response_code(500); }
echo json_encode(['success' => $ok]);
