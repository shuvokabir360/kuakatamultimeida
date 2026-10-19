<?php
/**
 * Auth Middleware for token verification
 */

require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../utils/response.php';

class AuthMiddleware {
    public static function getBearerToken(): ?string {
        $headers = '';
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
        } elseif (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
            if (isset($requestHeaders['Authorization'])) {
                $headers = trim($requestHeaders['Authorization']);
            }
        }

        if (!empty($headers) && preg_match('/Bearer\s(\S+)/i', $headers, $matches)) {
            return $matches[1];
        }

        return null;
    }

    public static function getUser(): ?array {
        $token = self::getBearerToken();
        if (!$token) return null;

        $config = require __DIR__ . '/../config/config.php';
        return JWT::decode($token, $config['jwt']['secret']);
    }

    public static function requireAuth(): array {
        $user = self::getUser();
        if (!$user) {
            Response::error('অনুমতি নেই। অনুগ্রহ করে লগইন করুন।', 401);
        }
        return $user;
    }
}
