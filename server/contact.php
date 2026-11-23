<?php
/* =====================================================================
 * contact.php — emails website enquiries to the firm via authenticated SMTP.
 *
 * Sits in the web root next to index.html. Shares hsg-mail.php (SMTP +
 * lead log) and mail-config.php (credentials, NOT in git — upload by hand,
 * see mail-config.example.php) with the HSG Property app. Every accepted
 * enquiry is appended to leads.log.jsonl BEFORE the email is attempted so a
 * mail failure never loses a client.
 *
 * Accepts a JSON body (the site's JS) or a normal form POST (no-JS fallback).
 * ===================================================================== */

require_once __DIR__ . '/hsg-mail.php';

$cfg = hsg_mail_config();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
if (strlen($raw) > 20000) {
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => 'Payload too large']);
    exit;
}
$data = json_decode($raw, true);
$isJson = is_array($data);
if (!$isJson) { $data = $_POST; }

/* Honeypot: the field name is deliberately meaningless so browser autofill never
 * touches it. Trips are logged, not discarded, so a false positive can be rescued. */
$honeypot = is_array($data['hsg_leave_blank'] ?? '') ? '' : trim((string)($data['hsg_leave_blank'] ?? ''));
if ($honeypot !== '') {
    $line = json_encode([
        'timestamp' => gmdate('c'),
        'ip'        => (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        'ua'        => mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200),
        'honeypot'  => mb_substr($honeypot, 0, 100),
        'name'      => mb_substr((string)($data['name'] ?? ''), 0, 100),
        'email'     => mb_substr((string)($data['email'] ?? ''), 0, 120),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line !== false) {
        @file_put_contents(hsg_log_dir() . DIRECTORY_SEPARATOR . 'honeypot.log.jsonl', $line . "\n", FILE_APPEND | LOCK_EX);
    }
    echo json_encode(['success' => true]);
    exit;
}

$clean = function ($s) { return is_array($s) ? '' : trim(str_replace(["\r", "\n"], ' ', (string)$s)); };
$name    = mb_substr($clean($data['name'] ?? ''), 0, 100);
$phone   = mb_substr($clean($data['phone'] ?? ''), 0, 40);
$email   = mb_substr($clean($data['email'] ?? ''), 0, 120);
$subject = mb_substr($clean($data['subject'] ?? ''), 0, 80);
$message = mb_substr(trim((string)(is_array($data['message'] ?? '') ? '' : ($data['message'] ?? ''))), 0, 5000);
$consent = filter_var($data['consent'] ?? false, FILTER_VALIDATE_BOOLEAN) || (($data['consent'] ?? '') === 'yes');

if ($name === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$consent) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid input']);
    exit;
}

/* Rate limit: sliding window per IP, file-based, fails open. */
$RATE_MAX = 8; $RATE_WINDOW = 3600;
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$now = time();
try {
    $throttleFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'hsgweb_' . hash('sha256', $ip);
    $fh = @fopen($throttleFile, 'c+');
    if ($fh !== false) {
        if (@flock($fh, LOCK_EX)) {
            $contents = stream_get_contents($fh);
            $stamps = ($contents !== false && trim((string)$contents) !== '') ? array_map('intval', explode(',', trim($contents))) : [];
            $stamps = array_values(array_filter($stamps, fn ($t) => $t > 0 && ($now - $t) < $RATE_WINDOW));
            if (count($stamps) >= $RATE_MAX) {
                @flock($fh, LOCK_UN); @fclose($fh);
                http_response_code(429);
                echo json_encode(['success' => false, 'error' => 'Too many requests']);
                exit;
            }
            $stamps[] = $now;
            @ftruncate($fh, 0); @rewind($fh); @fwrite($fh, implode(',', $stamps)); @fflush($fh);
            @flock($fh, LOCK_UN);
        }
        @fclose($fh);
    }
} catch (Throwable $e) { /* fail open */ }

$record = [
    'timestamp'  => gmdate('c'),
    'ip'         => $ip,
    'source'     => 'website',
    'name'       => $name,
    'phone'      => $phone,
    'email'      => $email,
    'subject'    => $subject,
    'message'    => $message,
    'consent'    => true,
    'consent_ts' => gmdate('c'),
];
hsg_lead_append($record);

/* Build a plain, readable message for the firm. */
$fromHeader = (string)($cfg['from'] ?? 'HSG Website <webmaster@hsgattorneys.co.za>');
$to         = (string)($cfg['contact_to'] ?? $cfg['to']);
$subj       = mb_encode_mimeheader('Website enquiry' . ($subject !== '' ? ' — ' . $subject : '') . ' — ' . $name, 'UTF-8', 'B');
$lines = [
    'A new enquiry was sent from hsgattorneys.co.za.',
    '',
    'Name:    ' . $name,
    'Email:   ' . $email,
    'Phone:   ' . ($phone !== '' ? $phone : '—'),
    'Matter:  ' . ($subject !== '' ? $subject : '—'),
    '',
    'Message:',
    $message,
    '',
    '—',
    'Consent to process personal information (POPIA) was given at ' . $record['consent_ts'] . ' from ' . $ip . '.',
    'Reply directly to this email to respond to the client.',
];
$body = implode("\r\n", $lines);
$headers = implode("\r\n", [
    'From: ' . $fromHeader,
    'Reply-To: ' . mb_encode_mimeheader($name, 'UTF-8', 'B') . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-HSG-Source: website',
]);

[$ok, $log] = hsg_smtp_send($to, $subj, $body, $headers, $fromHeader);
if (!$ok) {
    @file_put_contents(hsg_log_dir() . DIRECTORY_SEPARATOR . 'mail-errors.log', gmdate('c') . ' ' . str_replace(["\r", "\n"], ' | ', $log) . "\n", FILE_APPEND | LOCK_EX);
}

hsg_housekeeping(__DIR__);

if (!$isJson) {
    // No-JS fallback: bounce back to the contact page with a status flag.
    header('Location: /contact/?sent=' . ($ok ? '1' : '0') . '#enquire', true, 303);
    exit;
}
echo json_encode(['success' => (bool)$ok]);
