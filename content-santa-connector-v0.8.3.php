<?php
/**
 * Plugin Name: Content Santa Connector
 * Description: Pull-model connector with full image pipeline instrumentation and evidence logging.
 * Version: 0.8.3
 * Author: Content Santa
 */

if (!defined('ABSPATH')) exit;

class ContentSantaConnector {
  const OPT_GROUP = 'content_santa_connector';
  const OPT_NAME  = 'content_santa_connector_settings';
  const CRON_HOOK = 'content_santa_connector_cron';

  public static function init() {
    add_action('admin_menu', [__CLASS__, 'admin_menu']);
    add_action('admin_init', [__CLASS__, 'register_settings']);
    add_filter('cron_schedules', [__CLASS__, 'add_cron_interval']);
    add_action(self::CRON_HOOK, [__CLASS__, 'cron_run']);
    register_activation_hook(__FILE__, [__CLASS__, 'activate']);
    register_deactivation_hook(__FILE__, [__CLASS__, 'deactivate']);
  }

  public static function defaults() {
    return [
      'base_url' => '',
      'site_id'  => '',
      'secret'   => '',
      'interval_minutes' => 3
    ];
  }

  public static function get_settings() {
    $saved = get_option(self::OPT_NAME, []);
    return wp_parse_args($saved, self::defaults());
  }

  public static function admin_menu() {
    add_options_page(
      'Content Santa Connector',
      'Content Santa Connector',
      'manage_options',
      'content-santa-connector',
      [__CLASS__, 'settings_page']
    );
  }

  public static function register_settings() {
    register_setting(self::OPT_GROUP, self::OPT_NAME, [
      'type' => 'array',
      'sanitize_callback' => [__CLASS__, 'sanitize_settings'],
      'default' => self::defaults()
    ]);

    add_settings_section('csc_main', 'Connector Settings', function() {
      echo '<p>Configure Content Santa pull connection with full image pipeline instrumentation.</p>';
    }, 'content-santa-connector');

    add_settings_field('base_url', 'Content Santa Base URL', [__CLASS__, 'field_base_url'], 'content-santa-connector', 'csc_main');
    add_settings_field('site_id', 'Site ID', [__CLASS__, 'field_site_id'], 'content-santa-connector', 'csc_main');
    add_settings_field('secret', 'Secret Key', [__CLASS__, 'field_secret'], 'content-santa-connector', 'csc_main');
    add_settings_field('interval_minutes', 'Poll Interval (minutes)', [__CLASS__, 'field_interval'], 'content-santa-connector', 'csc_main');
  }

  public static function sanitize_settings($input) {
    $out = self::defaults();
    $out['base_url'] = isset($input['base_url']) ? esc_url_raw(trim($input['base_url'])) : '';
    $out['site_id']  = isset($input['site_id']) ? sanitize_text_field(trim($input['site_id'])) : '';
    $out['secret']   = isset($input['secret']) ? sanitize_text_field(trim($input['secret'])) : '';
    $out['interval_minutes'] = isset($input['interval_minutes']) ? max(1, min(15, intval($input['interval_minutes']))) : 3;
    self::reschedule();
    return $out;
  }

  public static function field_base_url() {
    $s = self::get_settings();
    printf('<input type="text" name="%s[base_url]" value="%s" class="regular-text" placeholder="https://your-app.replit.app" />',
      esc_attr(self::OPT_NAME), esc_attr($s['base_url']));
  }

  public static function field_site_id() {
    $s = self::get_settings();
    printf('<input type="text" name="%s[site_id]" value="%s" class="regular-text" placeholder="cs_site_XXXX" />',
      esc_attr(self::OPT_NAME), esc_attr($s['site_id']));
  }

  public static function field_secret() {
    $s = self::get_settings();
    printf('<input type="password" name="%s[secret]" value="%s" class="regular-text" />',
      esc_attr(self::OPT_NAME), esc_attr($s['secret']));
    echo '<p class="description">Authenticate WP → Content Santa requests.</p>';
  }

  public static function field_interval() {
    $s = self::get_settings();
    printf('<input type="number" min="1" max="15" name="%s[interval_minutes]" value="%d" />',
      esc_attr(self::OPT_NAME), intval($s['interval_minutes']));
    echo '<p class="description">Recommended: 2–5 minutes.</p>';
  }

  public static function settings_page() {
    if (!current_user_can('manage_options')) return;
    $s = self::get_settings();
    $next = wp_next_scheduled(self::CRON_HOOK);
    $lastReport = get_option('csc_last_report', null);
    ?>
    <div class="wrap">
      <h1>Content Santa Connector</h1>
      <form method="post" action="options.php">
        <?php settings_fields(self::OPT_GROUP); do_settings_sections('content-santa-connector'); submit_button(); ?>
      </form>
      <hr />
      <h2>Status</h2>
      <p><strong>Cron:</strong> <?php echo $next ? 'Yes' : 'No'; ?></p>
      <p><strong>Next run:</strong> <?php echo $next ? esc_html(date('Y-m-d H:i:s', $next)) : '—'; ?></p>
      <p><strong>Version:</strong> 0.8.3 (Complete image optimization + callback logging + siteId/leaseToken support)</p>
      <?php if ($lastReport && is_array($lastReport)): ?>
        <h3>Last Pull Attempt</h3>
        <p><strong>Time:</strong> <?php echo esc_html(date('Y-m-d H:i:s', $lastReport['time'])); ?></p>
        <p><strong>HTTP Code:</strong> <?php echo esc_html($lastReport['code']); ?></p>
        <p><strong>Response:</strong> <code><?php echo esc_html($lastReport['response']); ?></code></p>
        <p><em>Check WordPress error_log for detailed debug output.</em></p>
      <?php endif; ?>
      <form method="post">
        <?php wp_nonce_field('csc_manual_run', 'csc_nonce'); ?>
        <input type="submit" class="button button-secondary" name="csc_run_now" value="Run Now (Manual Pull)" />
      </form>
    </div>
    <?php
    if (isset($_POST['csc_run_now']) && isset($_POST['csc_nonce']) && wp_verify_nonce($_POST['csc_nonce'], 'csc_manual_run')) {
      self::cron_run(true);
      echo '<div class="notice notice-success"><p>Manual pull executed. Check status above and WordPress error_log for details.</p></div>';
    }
  }

  public static function activate() { self::schedule(); }
  public static function deactivate() { wp_clear_scheduled_hook(self::CRON_HOOK); }

  public static function add_cron_interval($schedules) {
    $settings = self::get_settings();
    $minutes = max(1, intval($settings['interval_minutes']));
    $key = 'csc_every_' . $minutes . '_minutes';
    $schedules[$key] = ['interval' => $minutes * 60, 'display' => "Every {$minutes} min (CS)"];
    return $schedules;
  }

  public static function schedule() {
    $settings = self::get_settings();
    $minutes = max(1, intval($settings['interval_minutes']));
    $key = 'csc_every_' . $minutes . '_minutes';
    if (!wp_next_scheduled(self::CRON_HOOK)) {
      wp_schedule_event(time() + 60, $key, self::CRON_HOOK);
    }
  }

  public static function reschedule() {
    wp_clear_scheduled_hook(self::CRON_HOOK);
    self::schedule();
  }

  private static function api_headers($secret) {
    return [
      'Content-Type' => 'application/json',
      'X-ContentSanta-Secret' => $secret,
      'User-Agent' => 'ContentSantaConnector/0.8.3'
    ];
  }

  /**
   * INSTRUMENTED: Download and upload image with full evidence logging
   */
  private static function upload_featured_image_with_evidence($imageUrl, $postId, $postTitle, $jobId) {
    $evidence = [
      'step' => null,
      'http_code' => null,
      'bytes' => null,
      'attachment_id' => null,
      'set_thumbnail_ok' => false,
      'error' => null
    ];

    if (empty($imageUrl)) {
      $evidence['step'] = 'validation';
      $evidence['error'] = 'Empty image URL provided';
      error_log("[Content Santa] [{$jobId}] ERROR: Empty image URL");
      return $evidence;
    }

    if (!filter_var($imageUrl, FILTER_VALIDATE_URL)) {
      $evidence['step'] = 'validation';
      $evidence['error'] = 'Invalid image URL format';
      error_log("[Content Santa] [{$jobId}] ERROR: Invalid URL: {$imageUrl}");
      return $evidence;
    }

    // STEP 1: Download image
    error_log("[Content Santa] [{$jobId}] STEP 1: Downloading image from: {$imageUrl}");
    $evidence['step'] = 'download';
    
    $response = wp_remote_get($imageUrl, ['timeout' => 30, 'sslverify' => false]);
    
    if (is_wp_error($response)) {
      $evidence['error'] = $response->get_error_message();
      error_log("[Content Santa] [{$jobId}] STEP 1 FAILED: " . $evidence['error']);
      return $evidence;
    }

    $evidence['http_code'] = wp_remote_retrieve_response_code($response);
    error_log("[Content Santa] [{$jobId}] STEP 1: HTTP {$evidence['http_code']}");

    if ($evidence['http_code'] !== 200) {
      $evidence['error'] = "HTTP {$evidence['http_code']} response";
      error_log("[Content Santa] [{$jobId}] STEP 1 FAILED: Non-200 response");
      return $evidence;
    }

    $imageData = wp_remote_retrieve_body($response);
    if (empty($imageData)) {
      $evidence['error'] = 'Empty image data received';
      error_log("[Content Santa] [{$jobId}] STEP 1 FAILED: Empty response body");
      return $evidence;
    }

    $evidence['bytes'] = strlen($imageData);
    error_log("[Content Santa] [{$jobId}] STEP 1 SUCCESS: Downloaded " . number_format($evidence['bytes'] / 1024, 2) . " KB");

    // STEP 2: Optimize image if needed (compress large images)
    $evidence['step'] = 'optimization';
    error_log("[Content Santa] [{$jobId}] STEP 2: Checking image size for optimization");
    
    // If image is larger than 2MB, optimize it
    if ($evidence['bytes'] > 2 * 1024 * 1024) {
      error_log("[Content Santa] [{$jobId}] STEP 2: Large image detected (" . number_format($evidence['bytes'] / 1024 / 1024, 2) . " MB), optimizing...");
      
      // Try to optimize using GD or Imagick
      $tempFile = wp_tempnam($filename);
      file_put_contents($tempFile, $imageData);
      
      $editor = wp_get_image_editor($tempFile);
      if (!is_wp_error($editor)) {
        // Set quality to 85% for good balance between size and quality
        $editor->set_quality(85);
        
        // Resize if dimensions are huge (max 2000px on longest side)
        $size = $editor->get_size();
        if ($size['width'] > 2000 || $size['height'] > 2000) {
          $editor->resize(2000, 2000, false);
          error_log("[Content Santa] [{$jobId}] STEP 2: Resized from {$size['width']}x{$size['height']}");
        }
        
        $saved = $editor->save($tempFile);
        if (!is_wp_error($saved)) {
          $optimizedData = file_get_contents($tempFile);
          $oldSize = $evidence['bytes'];
          $newSize = strlen($optimizedData);
          
          if ($newSize < $oldSize) {
            $imageData = $optimizedData;
            $evidence['bytes'] = $newSize;
            $savings = 100 - ($newSize / $oldSize * 100);
            error_log("[Content Santa] [{$jobId}] STEP 2 SUCCESS: Optimized image - saved " . number_format($savings, 1) . "% (" . number_format($newSize / 1024, 2) . " KB)");
          } else {
            error_log("[Content Santa] [{$jobId}] STEP 2: Original is already optimal");
          }
        }
      }
      
      @unlink($tempFile);
    } else {
      error_log("[Content Santa] [{$jobId}] STEP 2: Image size OK, no optimization needed");
    }

    // STEP 3: Determine file type and extension
    $evidence['step'] = 'file_type';
    $contentType = wp_remote_retrieve_header($response, 'content-type');
    $extension = 'jpg';
    if (strpos($contentType, 'png') !== false) $extension = 'png';
    elseif (strpos($contentType, 'webp') !== false) $extension = 'webp';
    elseif (strpos($contentType, 'gif') !== false) $extension = 'gif';
    
    error_log("[Content Santa] [{$jobId}] STEP 3: Content-Type: {$contentType}, Extension: {$extension}");

    // STEP 4: Create filename
    $filename = sanitize_file_name($postTitle) . '-' . time() . '.' . $extension;
    if (strlen($filename) > 100) {
      $filename = 'featured-' . $postId . '-' . time() . '.' . $extension;
    }
    error_log("[Content Santa] [{$jobId}] STEP 4: Filename: {$filename}");

    // STEP 5: Upload to WordPress
    $evidence['step'] = 'upload';
    error_log("[Content Santa] [{$jobId}] STEP 5: Uploading to WordPress media library");
    
    $upload = wp_upload_bits($filename, null, $imageData);
    
    if (!empty($upload['error'])) {
      $evidence['error'] = $upload['error'];
      error_log("[Content Santa] [{$jobId}] STEP 5 FAILED: " . $upload['error']);
      return $evidence;
    }

    error_log("[Content Santa] [{$jobId}] STEP 5 SUCCESS: Uploaded to {$upload['file']}");

    // STEP 6: Create attachment
    $evidence['step'] = 'attachment';
    error_log("[Content Santa] [{$jobId}] STEP 6: Creating attachment record");
    
    $fileType = wp_check_filetype($filename, null);
    $attachment = [
      'post_mime_type' => $fileType['type'],
      'post_title'     => sanitize_file_name(pathinfo($filename, PATHINFO_FILENAME)),
      'post_content'   => '',
      'post_status'    => 'inherit'
    ];

    $attachId = wp_insert_attachment($attachment, $upload['file'], $postId);
    
    if (is_wp_error($attachId)) {
      $evidence['error'] = $attachId->get_error_message();
      error_log("[Content Santa] [{$jobId}] STEP 5 FAILED: " . $evidence['error']);
      return $evidence;
    }

    $evidence['attachment_id'] = $attachId;
    error_log("[Content Santa] [{$jobId}] STEP 5 SUCCESS: Attachment ID {$attachId}");

    // STEP 6: Generate metadata
    error_log("[Content Santa] [{$jobId}] STEP 6: Generating attachment metadata");
    require_once(ABSPATH . 'wp-admin/includes/image.php');
    $attachData = wp_generate_attachment_metadata($attachId, $upload['file']);
    wp_update_attachment_metadata($attachId, $attachData);
    error_log("[Content Santa] [{$jobId}] STEP 6 SUCCESS: Metadata generated");

    // STEP 7: Set as featured image
    $evidence['step'] = 'thumbnail';
    error_log("[Content Santa] [{$jobId}] STEP 7: Setting as featured image");
    
    $result = set_post_thumbnail($postId, $attachId);
    $evidence['set_thumbnail_ok'] = (bool)$result;
    
    if (!$result) {
      $evidence['error'] = 'set_post_thumbnail returned false';
      error_log("[Content Santa] [{$jobId}] STEP 7 FAILED: set_post_thumbnail returned false");
      return $evidence;
    }

    error_log("[Content Santa] [{$jobId}] STEP 7 SUCCESS: Featured image set");

    // STEP 8: Verify
    $thumbnailId = get_post_thumbnail_id($postId);
    if ($thumbnailId != $attachId) {
      $evidence['error'] = "Verification failed: thumbnail ID mismatch (expected {$attachId}, got {$thumbnailId})";
      error_log("[Content Santa] [{$jobId}] STEP 8 FAILED: {$evidence['error']}");
      return $evidence;
    }

    error_log("[Content Santa] [{$jobId}] STEP 8 SUCCESS: Verified thumbnail ID {$thumbnailId}");
    error_log("[Content Santa] [{$jobId}] ✅ IMAGE PIPELINE COMPLETE");
    
    $evidence['step'] = 'complete';
    return $evidence;
  }

  public static function cron_run($manual = false) {
    $settings = self::get_settings();
    $base = rtrim($settings['base_url'], '/');
    $siteId = $settings['site_id'];
    $secret = $settings['secret'];

    // DEBUG: Log settings for troubleshooting
    error_log("[Content Santa] DEBUG: base_url=" . $base);
    error_log("[Content Santa] DEBUG: site_id=" . $siteId);
    error_log("[Content Santa] DEBUG: secret_length=" . strlen($secret));

    if (!$base || !$siteId || !$secret) {
      error_log("[Content Santa] ERROR: Missing required settings (base_url, site_id, or secret)");
      update_option('csc_last_report', [
        'time' => time(),
        'code' => 0,
        'response' => 'Missing required settings. Check Content Santa Base URL, Site ID, and Secret Key.',
      ]);
      return;
    }

    // 1) Pull job
    $pullUrl = $base . '/api/wp/pull?siteId=' . rawurlencode($siteId);
    error_log("[Content Santa] DEBUG: Pull URL=" . $pullUrl);
    
    $resp = wp_remote_get($pullUrl, ['timeout' => 20, 'headers' => self::api_headers($secret)]);

    if (is_wp_error($resp)) {
      $errMsg = $resp->get_error_message();
      error_log("[Content Santa] ERROR: wp_remote_get failed: " . $errMsg);
      update_option('csc_last_report', [
        'time' => time(),
        'code' => 0,
        'response' => 'HTTP Error: ' . $errMsg,
      ]);
      return;
    }
    
    $code = wp_remote_retrieve_response_code($resp);
    $body = wp_remote_retrieve_body($resp);
    
    error_log("[Content Santa] DEBUG: Response code=" . $code);
    error_log("[Content Santa] DEBUG: Response body=" . substr($body, 0, 200));
    
    // Store last pull attempt
    update_option('csc_last_report', [
      'time' => time(),
      'code' => $code,
      'response' => substr($body, 0, 200),
    ]);
    
    if ($code === 204 || !$body) {
      error_log("[Content Santa] INFO: No jobs available (204 or empty response)");
      return;
    }
    
    if ($code !== 200) {
      error_log("[Content Santa] ERROR: Non-200 response code: " . $code);
      return;
    }

    $job = json_decode($body, true);
    if (!is_array($job) || empty($job['jobId'])) return;

    $jobId = $job['jobId'];
    error_log("[Content Santa] [{$jobId}] JOB RECEIVED: {$job['title']}");
    
    // ✅ IDEMPOTENCY CHECK: Skip if already processed
    $processedJobs = get_option('csc_processed_jobs', []);
    if (isset($processedJobs[$jobId])) {
      error_log("[Content Santa] [{$jobId}] SKIPPING: Already processed (WP Post ID: {$processedJobs[$jobId]})");
      return;
    }

    $result = [
      'siteId' => $siteId, // Include siteId for deterministic server-side mapping
      'leaseToken' => $job['leaseToken'] ?? null,
      'jobId' => $jobId,
      'ok' => false,
      'wpPostId' => null,
      'wpUrl' => null,
      'error' => null,
      // NEW: Image evidence
      'imageHttpCode' => null,
      'imageBytes' => null,
      'wpAttachmentId' => null,
      'setThumbnailOk' => false,
      'errorStep' => null,
      'errorDetails' => null
    ];

    try {
      $postarr = [
        'post_title'   => isset($job['title']) ? wp_strip_all_tags($job['title']) : '(No title)',
        'post_content' => isset($job['contentHtml']) ? $job['contentHtml'] : '',
        'post_status'  => (isset($job['status']) && $job['status'] === 'publish') ? 'publish' : 'draft',
        'post_type'    => 'post',
      ];

      if (!empty($job['excerpt'])) $postarr['post_excerpt'] = wp_strip_all_tags($job['excerpt']);
      if (!empty($job['slug'])) $postarr['post_name'] = sanitize_title($job['slug']);

      // Categories
      if (!empty($job['categories']) && is_array($job['categories'])) {
        $catIds = [];
        foreach ($job['categories'] as $catName) {
          $catName = sanitize_text_field($catName);
          if (!$catName) continue;
          $term = term_exists($catName, 'category');
          if (!$term) $term = wp_insert_term($catName, 'category');
          if (!is_wp_error($term) && isset($term['term_id'])) $catIds[] = intval($term['term_id']);
        }
        if (!empty($catIds)) $postarr['post_category'] = $catIds;
      }

      $postId = wp_insert_post($postarr, true);
      if (is_wp_error($postId)) throw new Exception($postId->get_error_message());
      
      error_log("[Content Santa] [{$jobId}] POST CREATED: ID {$postId}");

      // Tags
      if (!empty($job['tags']) && is_array($job['tags'])) {
        $tags = array_values(array_filter(array_map('sanitize_text_field', $job['tags'])));
        if (!empty($tags)) wp_set_post_tags($postId, $tags, false);
      }

      // Featured Image WITH EVIDENCE
      if (!empty($job['featuredImageUrl'])) {
        error_log("[Content Santa] [{$jobId}] STARTING IMAGE PIPELINE");
        $evidence = self::upload_featured_image_with_evidence(
          $job['featuredImageUrl'],
          $postId,
          $postarr['post_title'],
          $jobId
        );

        $result['imageHttpCode'] = $evidence['http_code'];
        $result['imageBytes'] = $evidence['bytes'];
        $result['wpAttachmentId'] = $evidence['attachment_id'];
        $result['setThumbnailOk'] = $evidence['set_thumbnail_ok'];
        $result['errorStep'] = $evidence['step'] !== 'complete' ? $evidence['step'] : null;
        $result['errorDetails'] = $evidence['error'];

        if ($evidence['step'] !== 'complete') {
          error_log("[Content Santa] [{$jobId}] IMAGE PIPELINE FAILED AT: {$evidence['step']}");
          // Don't fail the whole job, just mark image issue
        } else {
          error_log("[Content Santa] [{$jobId}] IMAGE PIPELINE SUCCESS");
        }
      } else {
        error_log("[Content Santa] [{$jobId}] NO FEATURED IMAGE URL PROVIDED");
      }

      $result['ok'] = true;
      $result['wpPostId'] = $postId;
      $result['wpUrl'] = get_permalink($postId);
      
      // ✅ STORE PROCESSED JOB: Prevent re-processing same job
      $processedJobs = get_option('csc_processed_jobs', []);
      $processedJobs[$jobId] = $postId;
      
      // Keep only last 100 jobs to prevent option bloat
      if (count($processedJobs) > 100) {
        $processedJobs = array_slice($processedJobs, -100, 100, true);
      }
      
      update_option('csc_processed_jobs', $processedJobs);
      error_log("[Content Santa] [{$jobId}] MARKED AS PROCESSED (total tracked: " . count($processedJobs) . ")");

    } catch (Exception $e) {
      $result['error'] = $e->getMessage();
      error_log("[Content Santa] [{$jobId}] JOB FAILED: " . $e->getMessage());
    }

    // 2) Report back WITH EVIDENCE
    $reportUrl = $base . '/api/wp/report';
    $reportResp = wp_remote_post($reportUrl, [
      'timeout' => 20,
      'headers' => self::api_headers($secret),
      'body'    => wp_json_encode($result)
    ]);

    // CRITICAL LOGGING: Log full callback response for debugging
    if (is_wp_error($reportResp)) {
      $errorMsg = $reportResp->get_error_message();
      error_log("[Content Santa] [{$jobId}] ❌ CALLBACK FAILED: " . $errorMsg);
      update_option('csc_last_report_status', [
        'code' => 0,
        'body' => 'WP_Error: ' . $errorMsg,
        'time' => date('Y-m-d H:i:s')
      ]);
    } else {
      $reportCode = wp_remote_retrieve_response_code($reportResp);
      $reportBody = wp_remote_retrieve_body($reportResp);
      error_log("[Content Santa] [{$jobId}] CALLBACK RESPONSE CODE: {$reportCode}");
      error_log("[Content Santa] [{$jobId}] CALLBACK RESPONSE BODY: " . substr($reportBody, 0, 500));
      
      // Store last report for display
      update_option('csc_last_report_status', [
        'code' => $reportCode,
        'body' => substr($reportBody, 0, 500),
        'time' => date('Y-m-d H:i:s')
      ]);
      
      if ($reportCode === 200) {
        error_log("[Content Santa] [{$jobId}] ✅ CALLBACK SUCCESS");
      } else {
        error_log("[Content Santa] [{$jobId}] ⚠️ CALLBACK NON-200: HTTP {$reportCode}");
      }
    }
  }
}

ContentSantaConnector::init();
