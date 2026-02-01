<?php
/**
 * MDReader - Save Document API
 * Saves markdown content to server and returns unique document ID
 */

// CORS configuration - restrict to allowed domains
$allowedOrigins = [
    'http://localhost:8000',
    'http://localhost:3000',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:3000',
    'https://zaiden.eng.br',
    'https://md.zaiden.eng.br',
    'https://md-dev.zaiden.eng.br',
    // Add your production domain here: 'https://yourdomain.com'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Only set CORS header for whitelisted origins
// Same-origin requests will work without CORS headers
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

// Configuration
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB limit
define('DOCUMENTS_DIR', __DIR__ . '/../documents/');
define('RATE_LIMIT', 10); // 10 requests per hour per IP
define('RATE_WINDOW', 3600); // 1 hour in seconds

// Ensure documents directory exists
if (!is_dir(DOCUMENTS_DIR)) {
    mkdir(DOCUMENTS_DIR, 0755, true);
}

/**
 * Check rate limit for IP address
 * Prevents spam and DOS attacks
 * Uses file locking to prevent race conditions
 */
function checkRateLimit($ip) {
    $rateLimitFile = sys_get_temp_dir() . '/mdreader_rate_' . md5($ip) . '.json';

    // Open file with lock support (create if doesn't exist)
    $fp = fopen($rateLimitFile, 'c+');
    if (!$fp) {
        throw new Exception('Rate limit check failed - unable to open file');
    }

    // Acquire exclusive lock (blocks until available)
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        throw new Exception('Rate limit check failed - unable to lock file');
    }

    try {
        // Read existing data
        $content = fread($fp, 8192);
        $data = json_decode($content ?: '{}', true);

        // Validate and update rate limit data
        if ($data && isset($data['timestamp']) && isset($data['count'])) {
            // Check if within rate window
            if (time() - $data['timestamp'] < RATE_WINDOW) {
                if ($data['count'] >= RATE_LIMIT) {
                    http_response_code(429);
                    throw new Exception('Rate limit exceeded. Please try again later.');
                }
                $data['count']++;
            } else {
                // Window expired, reset counter
                $data = ['timestamp' => time(), 'count' => 1];
            }
        } else {
            // First request or invalid data
            $data = ['timestamp' => time(), 'count' => 1];
        }

        // Write updated data back to file
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data));
        fflush($fp);

    } finally {
        // Always release lock and close file
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

/**
 * Sanitize error message to prevent XSS
 * Removes potentially dangerous characters from error messages
 * @param string $message - The error message to sanitize
 * @return string - Sanitized error message
 */
function sanitizeErrorMessage($message) {
    // Remove HTML tags and encode special characters
    $message = strip_tags($message);
    $message = htmlspecialchars($message, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    // Limit length to prevent extremely long error messages
    return mb_substr($message, 0, 500);
}

/**
 * Generate short, clean ID (8 alphanumeric characters)
 * Uses cryptographically secure random generation
 * Includes uniqueness check to prevent ID collisions
 */
function generateShortId() {
    $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $maxAttempts = 10;

    for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
        $id = '';

        // Use purely random generation (no timestamp to prevent predictability)
        for ($i = 0; $i < 8; $i++) {
            $id .= $chars[random_int(0, strlen($chars) - 1)];
        }

        // Check if file exists - ensure uniqueness
        if (!file_exists(DOCUMENTS_DIR . $id . '.md')) {
            return $id;
        }
    }

    // If we couldn't generate a unique ID after max attempts, throw error
    throw new Exception('Failed to generate unique ID after ' . $maxAttempts . ' attempts');
}

/**
 * Create URL-friendly slug from title
 */
function createSlug($title) {
    // Convert to lowercase
    $slug = strtolower($title);

    // Remove .md extension if present
    $slug = preg_replace('/\.md$/', '', $slug);

    // Replace spaces and special chars with hyphens
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);

    // Remove leading/trailing hyphens
    $slug = trim($slug, '-');

    // Limit length
    $slug = substr($slug, 0, 50);

    // If empty or "untitled", return empty (will use ID only)
    if (empty($slug) || $slug === 'untitled') {
        return '';
    }

    return $slug;
}

try {
    // Check rate limit
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    checkRateLimit($clientIp);

    // Get POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Validate input
    if (!isset($data['content'])) {
        throw new Exception('No content provided');
    }

    $content = $data['content'];

    // Validate content type
    if (!is_string($content)) {
        throw new Exception('Content must be a string');
    }

    // Check for suspicious patterns (PHP code, script tags)
    if (preg_match('/<\?php|<\?=|<script[\s>]/i', $content)) {
        error_log("Suspicious content detected from IP: " . $clientIp);
        // Allow but log - markdown might contain code examples
    }

    // Sanitize title to prevent XSS
    $title = isset($data['title']) ? $data['title'] : 'Untitled';
    $title = strip_tags(trim($title)); // Remove HTML tags
    $title = mb_substr($title, 0, 255); // Limit length

    if (empty($title)) {
        $title = 'Untitled';
    }

    // Validate content size
    if (strlen($content) > MAX_FILE_SIZE) {
        throw new Exception('Content exceeds maximum size of 5MB');
    }

    // Generate short, clean ID (8 characters: alphanumeric)
    $id = generateShortId();

    // Create slug from title for better URLs
    $slug = createSlug($title);

    // Create document metadata
    $metadata = [
        'id' => $id,
        'slug' => $slug,
        'title' => $title,
        'created' => date('Y-m-d H:i:s'),
        'size' => strlen($content),
        'hash' => md5($content)
    ];

    // Save content using atomic operations (write to temp files, then rename)
    $contentFile = DOCUMENTS_DIR . $id . '.md';
    $metadataFile = DOCUMENTS_DIR . $id . '.json';
    $tempContentFile = $contentFile . '.tmp';
    $tempMetadataFile = $metadataFile . '.tmp';

    // Write to temporary files first
    if (file_put_contents($tempContentFile, $content) === false) {
        throw new Exception('Failed to save document');
    }

    if (file_put_contents($tempMetadataFile, json_encode($metadata, JSON_PRETTY_PRINT)) === false) {
        // Clean up temp content file if metadata write fails
        unlink($tempContentFile);
        throw new Exception('Failed to save metadata');
    }

    // Atomically rename both files (prevents race conditions)
    if (!rename($tempContentFile, $contentFile)) {
        unlink($tempContentFile);
        unlink($tempMetadataFile);
        throw new Exception('Failed to finalize document save');
    }

    if (!rename($tempMetadataFile, $metadataFile)) {
        // If metadata rename fails, remove the content file
        unlink($contentFile);
        unlink($tempMetadataFile);
        throw new Exception('Failed to finalize metadata save');
    }

    // Return success response
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'id' => $id,
        'slug' => $slug,
        'title' => $title,
        'created' => $metadata['created'],
        'url' => getDocumentUrl($id, $slug)
    ]);

} catch (Exception $e) {
    // Log error for debugging (with full unsanitized message)
    error_log("MDReader Save API Error: " . $e->getMessage() . " - IP: " . ($clientIp ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown'));

    // Only set error code if not already set
    if (http_response_code() === 200) {
        http_response_code(400);
    }

    // Sanitize error message before sending to client to prevent XSS
    echo json_encode([
        'success' => false,
        'error' => sanitizeErrorMessage($e->getMessage())
    ]);
}

/**
 * Generate document URL with optional slug
 */
function getDocumentUrl($id, $slug = '') {
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname(dirname($_SERVER['SCRIPT_NAME']));

    // Format: ?doc=slug-id or ?doc=id (if no slug)
    $docParam = !empty($slug) ? $slug . '-' . $id : $id;

    return $protocol . '://' . $host . $path . '?doc=' . $docParam;
}
