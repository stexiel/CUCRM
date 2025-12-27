<?php
/**
 * Router for PHP built-in server
 * Handles routing for EspoCRM
 */

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Serve static files from client directory
if (preg_match('/^\/client\//', $uri)) {
    $filePath = __DIR__ . $uri;
    if (file_exists($filePath) && is_file($filePath)) {
        return false; // Let PHP serve the file
    }
    http_response_code(404);
    exit;
}

// Block access to protected directories
$blockedPaths = ['/data/', '/application/', '/custom/', '/vendor/'];
foreach ($blockedPaths as $path) {
    if (strpos($uri, $path) === 0) {
        http_response_code(403);
        exit('Forbidden');
    }
}

// Route API requests
if (preg_match('/^\/api\/v1\//', $uri)) {
    $_SERVER['SCRIPT_NAME'] = '/api/v1/index.php';
    require __DIR__ . '/public/api/v1/index.php';
    exit;
}

// Route portal requests
if (preg_match('/^\/portal\//', $uri)) {
    $_SERVER['SCRIPT_NAME'] = '/portal/index.php';
    require __DIR__ . '/public/portal/index.php';
    exit;
}

// Route OAuth callback
if (preg_match('/^\/oauth\/callback/', $uri)) {
    $_SERVER['SCRIPT_NAME'] = '/oauth/callback/index.php';
    require __DIR__ . '/public/oauth/callback/index.php';
    exit;
}

// Default: serve through public/index.php
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/public/index.php';
