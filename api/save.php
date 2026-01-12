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

    // Sanitize title for filename
    $safeTitle = preg_replace('/[^a-zA-Z0-9_-]/', '', str_replace(' ', '_', $title));
    $safeTitle = substr($safeTitle, 0, 50); // Limit title length

    // Generate unique ID
    $id = uniqid('doc_', true);

    // Create document metadata
    $metadata = [
        'id' => $id,
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
        'title' => $title,
        'created' => $metadata['created'],
        'url' => getDocumentUrl($id)
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Generate document URL
 */
function getDocumentUrl($id) {
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname(dirname($_SERVER['SCRIPT_NAME']));
    return $protocol . '://' . $host . $path . '?doc=' . $id;
}
