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

    // Envelope + From identity. MUST be a real mailbox on a domain that
    // publishes SPF for this server. app.hsgattorneys.co.za publishes
    // "v=spf1 mx a include:spf.host-h.net ?all"; the parent
    // hsgattorneys.co.za publishes NO SPF, so do not send as the parent.
    // The website reuses the app's mailbox: app.hsgattorneys.co.za publishes SPF,
    // the bare hsgattorneys.co.za domain does not (yet). If a root-domain mailbox is
    // ever preferred, add an SPF record for hsgattorneys.co.za first.
    'from' => 'HSG Website <webmaster@app.hsgattorneys.co.za>',

    // Prefixed to every enquiry subject, followed by " — " and the name.
    // The em dash is MIME-encoded by hsg-mail.php; do not "fix" that by
    // reverting to a plain hyphen — see the header-encoding note there.
    'subject_prefix' => 'New property enquiry',

    // Optional: a different mailbox for website (non-calculator) enquiries.
    // 'contact_to' => 'legal@hsginc.co.za',

    // Optional: where "testimonial for review" notifications go (testimonial.php).
    // Falls back to 'to'.
    // 'testimonials_to' => 'you@hsginc.co.za',

    // Testimonials sent in through the website are added to the admin's review queue
    // (content/testimonials/ in the site's GitHub repository, marked Pending). The token
    // is a GitHub FINE-GRAINED personal access token limited to that ONE repository,
    // with Contents: Read and write and nothing else. Without this block the
    // testimonial is still kept (testimonials.log.jsonl) and emailed, and the email
    // says it must be added to the admin by hand.
    // 'github' => [
    //     'token'  => 'github_pat_PUT-THE-REAL-TOKEN-HERE',
    //     'repo'   => 'MHB2730/hsg-site',
    //     'branch' => 'main',
    // ],

    'smtp' => [
        'host'     => 'smtp.app.hsgattorneys.co.za',
        'port'     => 465,                 // implicit TLS (ssl://)
        'username' => 'webmaster@app.hsgattorneys.co.za',
        'password' => 'PUT-THE-REAL-PASSWORD-HERE',
        'timeout'  => 30,
    ],
];
