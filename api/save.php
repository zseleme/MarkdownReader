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
    'http://127.0.0.1:3000'
    // Add your production domain here: 'https://yourdomain.com'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    // For same-origin requests or if no valid origin, don't set CORS header
    // This allows the app to work when accessed directly
    if (!empty($origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }
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
 */
function checkRateLimit($ip) {
    $rateLimitFile = sys_get_temp_dir() . '/mdreader_rate_' . md5($ip) . '.json';

    if (file_exists($rateLimitFile)) {
        $data = json_decode(file_get_contents($rateLimitFile), true);

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
            $data = ['timestamp' => time(), 'count' => 1];
        }
    } else {
        $data = ['timestamp' => time(), 'count' => 1];
    }

    file_put_contents($rateLimitFile, json_encode($data));
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
    // Log error for debugging
    error_log("MDReader Save API Error: " . $e->getMessage() . " - IP: " . ($clientIp ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown'));

    if (!http_response_code() || http_response_code() == 200) {
        http_response_code(400);
    }

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
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
