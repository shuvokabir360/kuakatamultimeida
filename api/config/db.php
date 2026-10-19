<?php
/**
 * Database connection using PDO MySQL
 */

class Database {
    private static ?PDO $pdo = null;

    public static function getConnection(): PDO {
        if (self::$pdo === null) {
            $config = require __DIR__ . '/config.php';
            $db = $config['db'];

            $dsn = "mysql:host={$db['host']};port={$db['port']};dbname={$db['database']};charset={$db['charset']}";

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$pdo = new PDO($dsn, $db['username'], $db['password'], $options);
            } catch (PDOException $e) {
                // If database doesn't exist, try creating it (useful for local development)
                if ($e->getCode() == 1049) {
                    try {
                        $tempDsn = "mysql:host={$db['host']};port={$db['port']};charset={$db['charset']}";
                        $tempPdo = new PDO($tempDsn, $db['username'], $db['password'], $options);
                        $tempPdo->exec("CREATE DATABASE IF NOT EXISTS `{$db['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                        self::$pdo = new PDO($dsn, $db['username'], $db['password'], $options);
                    } catch (Exception $ex) {
                        http_response_code(500);
                        echo json_encode([
                            'error' => 'Database connection failed: ' . $ex->getMessage(),
                            'help'  => 'Please verify your MySQL credentials in api/config/config.php or import api/database.sql in phpMyAdmin'
                        ]);
                        exit;
                    }
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'error' => 'Database connection failed: ' . $e->getMessage(),
                        'help'  => 'Please verify your MySQL credentials in api/config/config.php or import api/database.sql in phpMyAdmin'
                    ]);
                    exit;
                }
            }

            self::ensureTables();
        }

        return self::$pdo;
    }

    /**
     * Automatically ensure all required tables and default admin exist
     */
    public static function ensureTables(): void {
        if (!self::$pdo) return;

        // Check if users table exists
        $stmt = self::$pdo->query("SHOW TABLES LIKE 'users'");
        if ($stmt->rowCount() === 0) {
            $sqlFile = __DIR__ . '/../database.sql';
            if (file_exists($sqlFile)) {
                $sql = file_get_contents($sqlFile);
                self::$pdo->exec($sql);
            }
        }
    }
}
