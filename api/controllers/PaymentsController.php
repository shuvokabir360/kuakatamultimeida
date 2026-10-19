<?php
/**
 * Payments, Bonuses & Monthly Salaries Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class PaymentsController {
    // --- PAYMENTS ---

    public static function list(): void {
        $pdo = Database::getConnection();

        $where = [];
        $params = [];

        if (!empty($_GET['member_id'])) {
            $where[] = "p.member_id = ?";
            $params[] = $_GET['member_id'];
        }
        if (!empty($_GET['from'])) {
            $where[] = "p.paid_at >= ?";
            $params[] = $_GET['from'];
        }
        if (!empty($_GET['to'])) {
            $where[] = "p.paid_at <= ?";
            $params[] = $_GET['to'] . ' 23:59:59';
        }

        $sql = "SELECT p.*, m.name as member_name, m.role as member_role
                FROM payments p
                LEFT JOIN members m ON p.member_id = m.id";

        if ($where) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }
        $sql .= " ORDER BY p.paid_at DESC, p.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $result = array_map(function ($r) {
            return [
                'id'         => (string)$r['id'],
                '_id'        => (string)$r['id'],
                'amount'     => (float)$r['amount'],
                'note'       => $r['note'] ?? '',
                'paid_at'    => $r['paid_at'],
                'owner_id'   => $r['owner_id'],
                'created_at' => $r['created_at'],
                'updated_at' => $r['updated_at'],
                'member_id'  => [
                    'id'   => (string)$r['member_id'],
                    '_id'  => (string)$r['member_id'],
                    'name' => $r['member_name'] ?? '',
                    'role' => $r['member_role'] ?? '',
                ],
            ];
        }, $rows);

        Response::json($result);
    }

    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $memberId = $data['member_id'] ?? null;
        $amount = (float)($data['amount'] ?? 0);
        $note = trim($data['note'] ?? '');
        $paidAt = !empty($data['paid_at']) ? date('Y-m-d H:i:s', strtotime($data['paid_at'])) : date('Y-m-d H:i:s');
        $ownerId = $user['id'] ?? 'default_admin';

        if (!$memberId || $amount <= 0) {
            Response::error('member_id and amount are required', 400);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO payments (member_id, amount, note, paid_at, owner_id) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$memberId, $amount, $note, $paidAt, $ownerId]);
        $id = $pdo->lastInsertId();

        Response::json([
            'id'        => (string)$id,
            '_id'       => (string)$id,
            'member_id' => (string)$memberId,
            'amount'    => $amount,
            'note'      => $note,
            'paid_at'   => $paidAt,
            'owner_id'  => $ownerId
        ], 201);
    }

    public static function delete(string $id): void {
        AuthMiddleware::requireAuth();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM payments WHERE id = ?");
        $stmt->execute([$id]);
        Response::json(['message' => 'Payment deleted']);
    }

    // --- BONUSES ---

    public static function listBonuses(): void {
        $pdo = Database::getConnection();

        $where = [];
        $params = [];

        if (!empty($_GET['member_id'])) {
            $where[] = "b.member_id = ?";
            $params[] = $_GET['member_id'];
        }
        if (!empty($_GET['from'])) {
            $where[] = "b.given_at >= ?";
            $params[] = $_GET['from'];
        }
        if (!empty($_GET['to'])) {
            $where[] = "b.given_at <= ?";
            $params[] = $_GET['to'] . ' 23:59:59';
        }

        $sql = "SELECT b.*, m.name as member_name, m.role as member_role
                FROM bonuses b
                LEFT JOIN members m ON b.member_id = m.id";

        if ($where) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }
        $sql .= " ORDER BY b.given_at DESC, b.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $result = array_map(function ($r) {
            return [
                'id'         => (string)$r['id'],
                '_id'        => (string)$r['id'],
                'amount'     => (float)$r['amount'],
                'reason'     => $r['reason'] ?? '',
                'given_at'   => $r['given_at'],
                'owner_id'   => $r['owner_id'],
                'created_at' => $r['created_at'],
                'updated_at' => $r['updated_at'],
                'member_id'  => [
                    'id'   => (string)$r['member_id'],
                    '_id'  => (string)$r['member_id'],
                    'name' => $r['member_name'] ?? '',
                    'role' => $r['member_role'] ?? '',
                ],
            ];
        }, $rows);

        Response::json($result);
    }

    public static function createBonus(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $memberId = $data['member_id'] ?? null;
        $amount = (float)($data['amount'] ?? 0);
        $reason = trim($data['reason'] ?? '');
        $givenAt = !empty($data['given_at']) ? date('Y-m-d H:i:s', strtotime($data['given_at'])) : date('Y-m-d H:i:s');
        $ownerId = $user['id'] ?? 'default_admin';

        if (!$memberId || $amount <= 0) {
            Response::error('member_id and amount are required', 400);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO bonuses (member_id, amount, reason, given_at, owner_id) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$memberId, $amount, $reason, $givenAt, $ownerId]);
        $id = $pdo->lastInsertId();

        Response::json([
            'id'        => (string)$id,
            '_id'       => (string)$id,
            'member_id' => (string)$memberId,
            'amount'    => $amount,
            'reason'    => $reason,
            'given_at'  => $givenAt,
            'owner_id'  => $ownerId
        ], 201);
    }

    public static function deleteBonus(string $id): void {
        AuthMiddleware::requireAuth();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM bonuses WHERE id = ?");
        $stmt->execute([$id]);
        Response::json(['message' => 'Bonus deleted']);
    }

    // --- MONTHLY SALARIES ---

    public static function listSalaries(): void {
        $pdo = Database::getConnection();

        $where = [];
        $params = [];

        if (!empty($_GET['member_id'])) {
            $where[] = "s.member_id = ?";
            $params[] = $_GET['member_id'];
        }
        if (!empty($_GET['month'])) {
            $where[] = "s.month = ?";
            $params[] = $_GET['month'];
        }
        if (!empty($_GET['from'])) {
            $where[] = "s.month >= ?";
            $params[] = $_GET['from'];
        }
        if (!empty($_GET['to'])) {
            $where[] = "s.month <= ?";
            $params[] = $_GET['to'];
        }

        $sql = "SELECT s.*, m.name as member_name, m.rate as member_rate
                FROM monthly_salaries s
                LEFT JOIN members m ON s.member_id = m.id";

        if ($where) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }
        $sql .= " ORDER BY s.month DESC, s.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $result = array_map(function ($r) {
            return [
                'id'         => (string)$r['id'],
                '_id'        => (string)$r['id'],
                'month'      => $r['month'],
                'amount'     => (float)$r['amount'],
                'owner_id'   => $r['owner_id'],
                'created_at' => $r['created_at'],
                'updated_at' => $r['updated_at'],
                'member_id'  => [
                    'id'   => (string)$r['member_id'],
                    '_id'  => (string)$r['member_id'],
                    'name' => $r['member_name'] ?? '',
                    'rate' => (float)($r['member_rate'] ?? 0),
                ],
            ];
        }, $rows);

        Response::json($result);
    }

    public static function saveSalary(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $memberId = $data['member_id'] ?? null;
        $month = trim($data['month'] ?? '');
        $amount = (float)($data['amount'] ?? 0);
        $ownerId = $user['id'] ?? 'default_admin';

        if (!$memberId || !$month) {
            Response::error('member_id and month are required', 400);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO monthly_salaries (member_id, month, amount, owner_id)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                amount = VALUES(amount),
                owner_id = VALUES(owner_id)
        ");
        $stmt->execute([$memberId, $month, $amount, $ownerId]);

        Response::json([
            'member_id' => (string)$memberId,
            'month'     => $month,
            'amount'    => $amount
        ]);
    }
}
