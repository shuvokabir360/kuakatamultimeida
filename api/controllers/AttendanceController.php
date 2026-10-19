<?php
/**
 * Attendance Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class AttendanceController {
    public static function formatAttendance(array $row): array {
        $record = [
            'id'            => (string)$row['id'],
            '_id'           => (string)$row['id'],
            'date'          => $row['date'],
            'present'       => (bool)$row['present'],
            'rate_override' => $row['rate_override'] !== null ? (float)$row['rate_override'] : null,
            'owner_id'      => $row['owner_id'],
            'created_at'    => $row['created_at'],
            'updated_at'    => $row['updated_at'],
            'member_id'     => [
                'id'        => (string)$row['member_id'],
                '_id'       => (string)$row['member_id'],
                'name'      => $row['member_name'] ?? '',
                'role'      => $row['member_role'] ?? '',
                'rate'      => (float)($row['member_rate'] ?? 0),
                'photo_url' => $row['member_photo_url'] ?? '',
            ],
            'shooting_id'   => null,
        ];

        if (!empty($row['shooting_id'])) {
            $record['shooting_id'] = [
                'id'         => (string)$row['shooting_id'],
                '_id'        => (string)$row['shooting_id'],
                'name'       => $row['shooting_name'] ?? '',
                'channel'    => $row['shooting_channel'] ?? '',
                'director'   => $row['shooting_director'] ?? '',
                'location'   => $row['shooting_location'] ?? '',
                'shoot_date' => $row['shooting_shoot_date'] ?? '',
            ];
        }

        return $record;
    }

    public static function list(): void {
        $pdo = Database::getConnection();

        $where = [];
        $params = [];

        if (!empty($_GET['date'])) {
            $where[] = "a.date = ?";
            $params[] = $_GET['date'];
        }
        if (!empty($_GET['member_id'])) {
            $where[] = "a.member_id = ?";
            $params[] = $_GET['member_id'];
        }
        if (!empty($_GET['shooting_id'])) {
            $where[] = "a.shooting_id = ?";
            $params[] = $_GET['shooting_id'];
        }
        if (!empty($_GET['from'])) {
            $where[] = "a.date >= ?";
            $params[] = $_GET['from'];
        }
        if (!empty($_GET['to'])) {
            $where[] = "a.date <= ?";
            $params[] = $_GET['to'];
        }

        $sql = "SELECT a.*, 
                       m.name as member_name, m.role as member_role, m.rate as member_rate, m.photo_url as member_photo_url,
                       s.name as shooting_name, s.channel as shooting_channel, s.director as shooting_director, s.location as shooting_location, s.shoot_date as shooting_shoot_date
                FROM attendance a
                LEFT JOIN members m ON a.member_id = m.id
                LEFT JOIN shootings s ON a.shooting_id = s.id";

        if ($where) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }
        $sql .= " ORDER BY a.date DESC, a.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $records = array_map([self::class, 'formatAttendance'], $stmt->fetchAll());
        Response::json($records);
    }

    public static function mark(): void {
        $user = AuthMiddleware::requireAuth();
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $items = isset($input[0]) ? $input : [$input];

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO attendance (member_id, date, present, shooting_id, rate_override, owner_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                present = VALUES(present),
                shooting_id = VALUES(shooting_id),
                rate_override = VALUES(rate_override),
                owner_id = VALUES(owner_id)
        ");

        $results = [];
        foreach ($items as $item) {
            $memberId = $item['member_id'] ?? null;
            $date = $item['date'] ?? null;
            if (!$memberId || !$date) continue;

            $present = isset($item['present']) ? (int)(bool)$item['present'] : 1;
            $shootingId = !empty($item['shooting_id']) ? (int)$item['shooting_id'] : null;
            $rateOverride = isset($item['rate_override']) && $item['rate_override'] !== null && $item['rate_override'] !== '' ? (float)$item['rate_override'] : null;
            $ownerId = $user['id'] ?? 'default_admin';

            $stmt->execute([$memberId, $date, $present, $shootingId, $rateOverride, $ownerId]);

            // Fetch record with joins
            $stmtGet = $pdo->prepare("
                SELECT a.*, 
                       m.name as member_name, m.role as member_role, m.rate as member_rate, m.photo_url as member_photo_url,
                       s.name as shooting_name, s.channel as shooting_channel, s.director as shooting_director, s.location as shooting_location, s.shoot_date as shooting_shoot_date
                FROM attendance a
                LEFT JOIN members m ON a.member_id = m.id
                LEFT JOIN shootings s ON a.shooting_id = s.id
                WHERE a.member_id = ? AND a.date = ?
                LIMIT 1
            ");
            $stmtGet->execute([$memberId, $date]);
            $row = $stmtGet->fetch();
            if ($row) {
                $results[] = self::formatAttendance($row);
            }
        }

        Response::json(isset($input[0]) ? $results : ($results[0] ?? ['ok' => true]));
    }

    public static function bulkMark(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $date = $data['date'] ?? null;
        $attendances = $data['attendances'] ?? [];
        $shootingId = !empty($data['shooting_id']) ? (int)$data['shooting_id'] : null;
        $ownerId = $user['id'] ?? 'default_admin';

        if (!$date || !is_array($attendances)) {
            Response::error('date and attendances array are required', 400);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO attendance (member_id, date, present, shooting_id, rate_override, owner_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                present = VALUES(present),
                shooting_id = VALUES(shooting_id),
                rate_override = VALUES(rate_override),
                owner_id = VALUES(owner_id)
        ");

        foreach ($attendances as $item) {
            if (empty($item['member_id'])) continue;
            $present = isset($item['present']) ? (int)(bool)$item['present'] : 1;
            $rateOverride = isset($item['rate_override']) && $item['rate_override'] !== null && $item['rate_override'] !== '' ? (float)$item['rate_override'] : null;

            $stmt->execute([$item['member_id'], $date, $present, $shootingId, $rateOverride, $ownerId]);
        }

        Response::json(['message' => 'Attendance updated successfully']);
    }

    public static function delete(?string $id): void {
        AuthMiddleware::requireAuth();
        $pdo = Database::getConnection();

        if ($id && is_numeric($id)) {
            $stmt = $pdo->prepare("DELETE FROM attendance WHERE id = ?");
            $stmt->execute([$id]);
        } elseif (!empty($_GET['member_id']) && !empty($_GET['date'])) {
            $stmt = $pdo->prepare("DELETE FROM attendance WHERE member_id = ? AND date = ?");
            $stmt->execute([$_GET['member_id'], $_GET['date']]);
        }

        Response::json(['message' => 'Attendance deleted']);
    }
}
