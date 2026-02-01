<?php
/**
 * MDReader - Load Document API
 * Loads markdown content by document ID
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

header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

// Configuration
define('DOCUMENTS_DIR', __DIR__ . '/../documents/');

/**
 * Extract document ID from URL parameter
 * Supports both formats: "a3b5c7d9" or "my-document-a3b5c7d9"
 */
function extractDocumentId($docParam) {
    // If contains hyphen, ID is the last segment
    if (strpos($docParam, '-') !== false) {
        $parts = explode('-', $docParam);
        return end($parts);
    }

    // Otherwise, the whole parameter is the ID
    return $docParam;
}

/**
 * Validate document ID format (8 alphanumeric characters)
 */
function isValidDocumentId($id) {
    return preg_match('/^[a-z0-9]{8}$/', $id);
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

try {
    // Get document ID from query parameter
    if (!isset($_GET['id']) || empty($_GET['id'])) {
        throw new Exception('No document ID provided');
    }

    $docParam = $_GET['id'];

    // Extract actual ID (handles both "id" and "slug-id" formats)
    $id = extractDocumentId($docParam);

    // Validate ID format (security: prevent directory traversal)
    if (!isValidDocumentId($id)) {
        throw new Exception('Invalid document ID format');
    }

    // Build file paths
    $contentFile = DOCUMENTS_DIR . $id . '.md';
    $metadataFile = DOCUMENTS_DIR . $id . '.json';

    // Prevent symlink attacks - validate real path
    $realContentPath = realpath($contentFile);
    $realDocsDir = realpath(DOCUMENTS_DIR);

    if ($realContentPath === false || strpos($realContentPath, $realDocsDir) !== 0) {
        http_response_code(403);
        throw new Exception('Invalid file path');
    }

    // Check if document exists
    if (!file_exists($contentFile)) {
        http_response_code(404);
        throw new Exception('Document not found');
    }

    // Read content and metadata
    $content = file_get_contents($contentFile);

    $metadata = [];
    if (file_exists($metadataFile)) {
        $metadataContent = file_get_contents($metadataFile);
        $metadata = json_decode($metadataContent, true);

        // Check for JSON decode errors
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("JSON decode error for $metadataFile: " . json_last_error_msg());
            $metadata = []; // Fallback to empty array if JSON is corrupted
        }
    }

    // Return document
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'id' => $id,
        'content' => $content,
        'title' => isset($metadata['title']) ? $metadata['title'] : 'Untitled',
        'created' => isset($metadata['created']) ? $metadata['created'] : null,
        'size' => strlen($content)
    ]);

} catch (Exception $e) {
    // Log error for debugging (with full unsanitized message)
    error_log("MDReader Load API Error: " . $e->getMessage() . " - IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . " - Requested ID: " . ($id ?? $_GET['id'] ?? 'none'));

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
