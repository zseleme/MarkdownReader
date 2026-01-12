<?php
/**
 * MDReader - Load Document API
 * Loads markdown content by document ID
 */

// Enable CORS if needed
header('Access-Control-Allow-Origin: *');
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

try {
    // Get document ID from query parameter
    if (!isset($_GET['id']) || empty($_GET['id'])) {
        throw new Exception('No document ID provided');
    }

    $id = $_GET['id'];

    // Validate ID format (security: prevent directory traversal)
    if (!preg_match('/^doc_[a-f0-9\.]+$/', $id)) {
        throw new Exception('Invalid document ID format');
    }

    // Build file paths
    $contentFile = DOCUMENTS_DIR . $id . '.md';
    $metadataFile = DOCUMENTS_DIR . $id . '.json';

    // Check if document exists
    if (!file_exists($contentFile)) {
        http_response_code(404);
        throw new Exception('Document not found');
    }

    // Read content and metadata
    $content = file_get_contents($contentFile);

    $metadata = [];
    if (file_exists($metadataFile)) {
        $metadata = json_decode(file_get_contents($metadataFile), true);
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
    if (!http_response_code()) {
        http_response_code(400);
    }
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
