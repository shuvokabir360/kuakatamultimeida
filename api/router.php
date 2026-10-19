<?php
/**
 * Router script for PHP built-in development server (php -S)
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve static files directly if they exist
$filePath = __DIR__ . '/..' . $uri;
if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    return false;
}

// Route everything else through api/index.php
$_SERVER['SCRIPT_NAME'] = '/api/index.php';
require __DIR__ . '/index.php';
