<?php
/**
 * MDReader - Save Document API
 * Saves markdown content to server and returns unique document ID
 */

// Enable CORS if needed
header('Access-Control-Allow-Origin: *');
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

// Ensure documents directory exists
if (!is_dir(DOCUMENTS_DIR)) {
    mkdir(DOCUMENTS_DIR, 0755, true);
}

/**
 * Generate short, clean ID (8 alphanumeric characters)
 */
function generateShortId() {
    $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    $id = '';

    // Use timestamp for uniqueness (base36 encoded)
    $timestamp = base_convert(time(), 10, 36);

    // Add random characters
    for ($i = 0; $i < 8; $i++) {
        $id .= $chars[random_int(0, strlen($chars) - 1)];
    }

    // Mix timestamp into the ID for better uniqueness
    $id = substr($timestamp . $id, 0, 8);

    return $id;
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
    // Get POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Validate input
    if (!isset($data['content'])) {
        throw new Exception('No content provided');
    }

    $content = $data['content'];
    $title = isset($data['title']) ? $data['title'] : 'Untitled';

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

    // Save content
    $contentFile = DOCUMENTS_DIR . $id . '.md';
    $metadataFile = DOCUMENTS_DIR . $id . '.json';

    if (file_put_contents($contentFile, $content) === false) {
        throw new Exception('Failed to save document');
    }

    if (file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT)) === false) {
        // Remove content file if metadata fails
        unlink($contentFile);
        throw new Exception('Failed to save metadata');
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
    http_response_code(400);
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
