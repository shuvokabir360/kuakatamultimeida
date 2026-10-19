<?php
/**
 * Kuakata Multimedia Finance - Configuration
 *
 * For cPanel/Production: Update DB credentials with your cPanel MySQL details.
 * For Local XAMPP/WAMP: Default is usually root with empty password.
 */

return [
    'db' => [
        'host'     => getenv('DB_HOST') ?: 'localhost',
        'port'     => getenv('DB_PORT') ?: '3306',
        'database' => getenv('DB_NAME') ?: 'km_finance',
        'username' => getenv('DB_USER') ?: 'root',
        'password' => getenv('DB_PASS') !== false ? getenv('DB_PASS') : '',
        'charset'  => 'utf8mb4',
    ],
    'jwt' => [
        'secret'     => getenv('JWT_SECRET') ?: 'km_finance_secret_key_2026_super_secure',
        'expiry_days'=> 30,
    ],
    'sms' => [
        'api_key'   => getenv('BULKSMSBD_API_KEY') ?: 'hK6LPcO9Bu6SpvR8r0l6',
        'sender_id' => getenv('BULKSMSBD_SENDER_ID') ?: '8809648908310',
    ],
    'app' => [
        'upload_dir' => __DIR__ . '/../../uploads',
        'upload_url' => '/uploads',
        'admin_pass' => '01747729757@SK',
    ]
];
