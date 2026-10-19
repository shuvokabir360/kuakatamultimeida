<?php
/**
 * Shootings & Expenses Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class ShootingsController {
    public static function formatShooting(array $row): array {
        $row['id'] = (string)$row['id'];
        $row['_id'] = (string)$row['id'];
        $row['contract_amount'] = (float)$row['contract_amount'];
        return $row;
    }

    public static function calculateSummary(int $shootingId): array {
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT * FROM shootings WHERE id = ? LIMIT 1");
        $stmt->execute([$shootingId]);
        $shooting = $stmt->fetch();
        if (!$shooting) {
            return ['present_count' => 0, 'attendance_cost' => 0, 'extra_cost' => 0, 'total_cost' => 0];
        }

        // Attendance
        $stmtAtt = $pdo->prepare("
            SELECT a.rate_override, m.rate as member_rate
            FROM attendance a
            LEFT JOIN members m ON a.member_id = m.id
            WHERE (a.shooting_id = ? OR a.date = ?) AND a.present = 1
        ");
        $stmtAtt->execute([$shootingId, $shooting['shoot_date']]);
        $attendances = $stmtAtt->fetchAll();

        $attCost = 0.0;
        $presentCount = count($attendances);
        foreach ($attendances as $att) {
            if ($att['rate_override'] !== null && is_numeric($att['rate_override'])) {
                $attCost += (float)$att['rate_override'];
            } elseif ($att['member_rate'] !== null) {
                $attCost += (float)$att['member_rate'];
            }
        }

        // Expenses
        $stmtExp = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM shooting_expenses WHERE shooting_id = ?");
        $stmtExp->execute([$shootingId]);
        $extraCost = (float)$stmtExp->fetch()['total'];

        return [
            'present_count'   => $presentCount,
            'attendance_cost' => round($attCost, 2),
            'extra_cost'      => round($extraCost, 2),
            'total_cost'      => round($attCost + $extraCost, 2),
        ];
    }

    public static function list(): void {
        $pdo = Database::getConnection();

        $where = [];
        $params = [];

        if (!empty($_GET['from'])) {
            $where[] = "shoot_date >= ?";
            $params[] = $_GET['from'];
        }
        if (!empty($_GET['to'])) {
            $where[] = "shoot_date <= ?";
            $params[] = $_GET['to'];
        }

        $sql = "SELECT * FROM shootings";
        if ($where) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }
        $sql .= " ORDER BY shoot_date DESC, id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $shootings = array_map([self::class, 'formatShooting'], $stmt->fetchAll());
        Response::json($shootings);
    }

    public static function getSummary(string $id): void {
        $summary = self::calculateSummary((int)$id);
        Response::json($summary);
    }

    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $name = trim($data['name'] ?? '');
        $shootDate = trim($data['shoot_date'] ?? '');

        if (!$name || !$shootDate) {
            Response::error('নাম এবং শুটিং এর তারিখ আবশ্যক', 400);
        }

        $pdo = Database::getConnection();

        // Check if shooting date already exists
        $stmtCheck = $pdo->prepare("SELECT * FROM shootings WHERE shoot_date = ? LIMIT 1");
        $stmtCheck->execute([$shootDate]);
        $existing = $stmtCheck->fetch();
        if ($existing) {
            Response::error("এই তারিখে ({$shootDate}) ইতিমধ্যে \"{$existing['name']}\" শুটিং তৈরি করা আছে। অনুগ্রহ করে অন্য তারিখ বাছুন।", 400);
        }

        $director = trim($data['director'] ?? '');
        $channel = trim($data['channel'] ?? '');
        $contractAmount = (float)($data['contract_amount'] ?? 0);
        $location = trim($data['location'] ?? '');
        $note = trim($data['note'] ?? '');
        $ownerId = $user['id'] ?? 'default_admin';

        $stmt = $pdo->prepare("INSERT INTO shootings (name, shoot_date, director, channel, contract_amount, location, note, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $shootDate, $director, $channel, $contractAmount, $location, $note, $ownerId]);
        $id = $pdo->lastInsertId();

        $stmtGet = $pdo->prepare("SELECT * FROM shootings WHERE id = ? LIMIT 1");
        $stmtGet->execute([$id]);
        Response::json(self::formatShooting($stmtGet->fetch()), 201);
    }

    public static function update(string $id): void {
        AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM shootings WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $shooting = $stmt->fetch();
        if (!$shooting) Response::error('Shooting not found', 404);

        if (!empty($data['shoot_date'])) {
            $shootDate = trim($data['shoot_date']);
            $stmtCheck = $pdo->prepare("SELECT * FROM shootings WHERE shoot_date = ? AND id != ? LIMIT 1");
            $stmtCheck->execute([$shootDate, $id]);
            $existing = $stmtCheck->fetch();
            if ($existing) {
                Response::error("এই তারিখে ({$shootDate}) ইতিমধ্যে \"{$existing['name']}\" শুটিং তৈরি করা আছে। অনুগ্রহ করে অন্য তারিখ বাছুন।", 400);
            }
        }

        $name = isset($data['name']) ? trim($data['name']) : $shooting['name'];
        $shootDate = isset($data['shoot_date']) ? trim($data['shoot_date']) : $shooting['shoot_date'];
        $director = isset($data['director']) ? trim($data['director']) : $shooting['director'];
        $channel = isset($data['channel']) ? trim($data['channel']) : $shooting['channel'];
        $contractAmount = isset($data['contract_amount']) ? (float)$data['contract_amount'] : (float)$shooting['contract_amount'];
        $location = isset($data['location']) ? trim($data['location']) : $shooting['location'];
        $note = isset($data['note']) ? trim($data['note']) : $shooting['note'];

        $stmtUp = $pdo->prepare("UPDATE shootings SET name = ?, shoot_date = ?, director = ?, channel = ?, contract_amount = ?, location = ?, note = ? WHERE id = ?");
        $stmtUp->execute([$name, $shootDate, $director, $channel, $contractAmount, $location, $note, $id]);

        $stmt->execute([$id]);
        Response::json(self::formatShooting($stmt->fetch()));
    }

    public static function delete(string $id): void {
        AuthMiddleware::requireAuth();
        $pdo = Database::getConnection();

        // Foreign keys or cascade will remove shooting_expenses, or delete explicitly
        $stmtExp = $pdo->prepare("DELETE FROM shooting_expenses WHERE shooting_id = ?");
        $stmtExp->execute([$id]);

        $stmt = $pdo->prepare("DELETE FROM shootings WHERE id = ?");
        $stmt->execute([$id]);

        Response::json(['message' => 'Shooting deleted']);
    }

    // --- SHOOTING EXPENSES ---

    public static function listExpenses(string $shootingId): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM shooting_expenses WHERE shooting_id = ? ORDER BY spent_at DESC, id DESC");
        $stmt->execute([$shootingId]);
        $rows = $stmt->fetchAll();

        $result = array_map(function ($r) {
            $r['id'] = (string)$r['id'];
            $r['_id'] = (string)$r['id'];
            $r['shooting_id'] = (string)$r['shooting_id'];
            $r['amount'] = (float)$r['amount'];
            return $r;
        }, $rows);

        Response::json($result);
    }

    public static function addExpense(string $shootingId): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $amount = (float)($data['amount'] ?? 0);
        $note = trim($data['note'] ?? '');
        $spentAt = !empty($data['spent_at']) ? date('Y-m-d H:i:s', strtotime($data['spent_at'])) : date('Y-m-d H:i:s');
        $ownerId = $user['id'] ?? 'default_admin';

        if ($amount <= 0) {
            Response::error('Amount is required', 400);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO shooting_expenses (shooting_id, amount, note, spent_at, owner_id) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$shootingId, $amount, $note, $spentAt, $ownerId]);
        $id = $pdo->lastInsertId();

        Response::json([
            'id'          => (string)$id,
            '_id'         => (string)$id,
            'shooting_id' => (string)$shootingId,
            'amount'      => $amount,
            'note'        => $note,
            'spent_at'    => $spentAt,
            'owner_id'    => $ownerId
        ], 201);
    }

    public static function deleteExpense(string $expenseId): void {
        AuthMiddleware::requireAuth();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM shooting_expenses WHERE id = ?");
        $stmt->execute([$expenseId]);
        Response::json(['message' => 'Expense deleted']);
    }
}
