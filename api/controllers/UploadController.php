<?php
/**
 * Upload Controller
 */

require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class UploadController {
    public static function upload(): void {
        AuthMiddleware::requireAuth();

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::error('No file uploaded or upload error', 400);
        }

        $file = $_FILES['file'];
        $maxSize = 10 * 1024 * 1024; // 10MB
        if ($file['size'] > $maxSize) {
            Response::error('File too large (Max 10MB)', 400);
        }

        $config = require __DIR__ . '/../config/config.php';
        $uploadDir = $config['app']['upload_dir'];
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'pdf', 'doc', 'docx'];
        if (!in_array($ext, $allowed)) {
            Response::error('Invalid file type. Allowed: jpg, png, webp, gif, svg, pdf, doc', 400);
        }

        $uniqueName = time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
        $destPath = $uploadDir . '/' . $uniqueName;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            Response::error('Failed to move uploaded file', 500);
        }

        $publicUrl = ($config['app']['upload_url'] ?? '/uploads') . '/' . $uniqueName;

        Response::json([
            'url'      => $publicUrl,
            'filename' => $uniqueName,
            'size'     => $file['size']
        ], 201);
    }
}
