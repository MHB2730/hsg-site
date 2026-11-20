<?php
/* =====================================================================
 * mail-config.example.php — template for mail-config.php (website copy).
 *
 * COPY this to mail-config.php ON THE SERVER and fill in the real values.
 * mail-config.php is deliberately .gitignore'd: it holds the SMTP password
 * and must never be committed. It is also denied over HTTP by .htaccess
 * (see the ^(mail-config|hsg-mail)\.php$ rule).
 *
 * Because it is not in the repo, it is NOT part of the deploy bundle
 * either — it is uploaded once, by hand, and left in place across
 * deploys. If contact.php ever returns a 500, a missing or malformed
 * mail-config.php is the first thing to check.
 * ===================================================================== */

return [
    // Where enquiries are delivered.
    'to' => 'legal@hsginc.co.za',

    // Envelope + From identity. MUST be a real mailbox on a domain whose SPF
    // record allows this server to send, or the firm's mail server will reject
    // or junk the enquiries. Check the domain's SPF before choosing it. (The real
    // mailbox and server are in the firm's records, not in this public repository.)
    'from' => 'HSG Website <MAILBOX@DOMAIN-WITH-SPF>',

    // Prefixed to every enquiry subject, followed by " — " and the name.
    // The em dash is MIME-encoded by hsg-mail.php; do not "fix" that by
    // reverting to a plain hyphen — see the header-encoding note there.
    'subject_prefix' => 'New property enquiry',

    // Optional: a different mailbox for website (non-calculator) enquiries.
    // 'contact_to' => 'legal@hsginc.co.za',

    // Optional: where "testimonial for review" notifications go (testimonial.php).
    // Falls back to 'to'.
    // 'testimonials_to' => 'you@hsginc.co.za',

    // No GitHub token belongs here. Testimonials are emailed and logged only; they are
    // never committed to the site's repository, which is public (testimonial.php).

    'smtp' => [
        'host'     => 'SMTP-HOST',
        'port'     => 465,                 // implicit TLS (ssl://)
        'username' => 'MAILBOX@DOMAIN-WITH-SPF',
        'password' => 'PUT-THE-REAL-PASSWORD-HERE',
        'timeout'  => 30,
    ],
];
