<?php
/**
 * Channels, Directors, Client Payments & Due Summary Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class ClientsController {
    // --- CHANNELS ---

    public static function listChannels(): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT * FROM channels ORDER BY name ASC");
        $channels = array_map(function ($c) {
            $c['id'] = (string)$c['id'];
            $c['_id'] = (string)$c['id'];
            $c['is_own'] = (bool)$c['is_own'];
            return $c;
        }, $stmt->fetchAll());
        Response::json($channels);
    }

    public static function createChannel(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $name = trim($data['name'] ?? $data['old_name'] ?? '');
        $oldName = trim($data['old_name'] ?? '');
        if (!$name) Response::error('Name is required', 400);

        $isOwn = !empty($data['is_own']) ? 1 : 0;
        $logoUrl = trim($data['logo_url'] ?? '');
        $color = trim($data['color'] ?? '');
        $ownerId = $user['id'] ?? 'default_admin';

        $pdo = Database::getConnection();

        $lookup = $oldName ?: $name;
        $stmtFind = $pdo->prepare("SELECT * FROM channels WHERE LOWER(name) = ? LIMIT 1");
        $stmtFind->execute([strtolower($lookup)]);
        $existing = $stmtFind->fetch();

        if ($existing) {
            $previousName = $existing['name'];
            $stmtUp = $pdo->prepare("UPDATE channels SET name = ?, is_own = ?, logo_url = ?, color = ? WHERE id = ?");
            $stmtUp->execute([$name, $isOwn, $logoUrl ?: $existing['logo_url'], $color ?: $existing['color'], $existing['id']]);

            if (strtolower($previousName) !== strtolower($name)) {
                $stmtSync1 = $pdo->prepare("UPDATE shootings SET channel = ? WHERE LOWER(channel) = ?");
                $stmtSync1->execute([$name, strtolower($previousName)]);

                $stmtSync2 = $pdo->prepare("UPDATE client_payments SET channel = ? WHERE LOWER(channel) = ?");
                $stmtSync2->execute([$name, strtolower($previousName)]);
            }

            $stmtGet = $pdo->prepare("SELECT * FROM channels WHERE id = ?");
            $stmtGet->execute([$existing['id']]);
            $res = $stmtGet->fetch();
            $res['id'] = (string)$res['id'];
            $res['is_own'] = (bool)$res['is_own'];
            Response::json($res);
        }

        $stmtIns = $pdo->prepare("INSERT INTO channels (name, is_own, logo_url, color, owner_id) VALUES (?, ?, ?, ?, ?)");
        $stmtIns->execute([$name, $isOwn, $logoUrl, $color, $ownerId]);
        $id = $pdo->lastInsertId();

        Response::json([
            'id'       => (string)$id,
            '_id'      => (string)$id,
            'name'     => $name,
            'is_own'   => (bool)$isOwn,
            'logo_url' => $logoUrl,
            'color'    => $color,
            'owner_id' => $ownerId
        ], 201);
    }

    public static function updateChannel(?string $id): void {
        AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $idOrName = $id ?: ($data['id'] ?? $data['old_name'] ?? $data['name'] ?? null);

        $pdo = Database::getConnection();

        $channel = null;
        if ($idOrName && is_numeric($idOrName)) {
            $stmt = $pdo->prepare("SELECT * FROM channels WHERE id = ? LIMIT 1");
            $stmt->execute([$idOrName]);
            $channel = $stmt->fetch();
        }
        if (!$channel && $idOrName) {
            $stmt = $pdo->prepare("SELECT * FROM channels WHERE LOWER(name) = ? LIMIT 1");
            $stmt->execute([strtolower($idOrName)]);
            $channel = $stmt->fetch();
        }

        if (!$channel) {
            self::createChannel();
            return;
        }

        $previousName = $channel['name'];
        $name = isset($data['name']) && trim($data['name']) ? trim($data['name']) : $channel['name'];
        $isOwn = isset($data['is_own']) ? (!empty($data['is_own']) ? 1 : 0) : $channel['is_own'];
        $logoUrl = isset($data['logo_url']) ? trim($data['logo_url']) : $channel['logo_url'];
        $color = isset($data['color']) ? trim($data['color']) : $channel['color'];

        $stmtUp = $pdo->prepare("UPDATE channels SET name = ?, is_own = ?, logo_url = ?, color = ? WHERE id = ?");
        $stmtUp->execute([$name, $isOwn, $logoUrl, $color, $channel['id']]);

        if (strtolower($previousName) !== strtolower($name)) {
            $stmtSync1 = $pdo->prepare("UPDATE shootings SET channel = ? WHERE LOWER(channel) = ?");
            $stmtSync1->execute([$name, strtolower($previousName)]);

            $stmtSync2 = $pdo->prepare("UPDATE client_payments SET channel = ? WHERE LOWER(channel) = ?");
            $stmtSync2->execute([$name, strtolower($previousName)]);
        }

        $stmtGet = $pdo->prepare("SELECT * FROM channels WHERE id = ?");
        $stmtGet->execute([$channel['id']]);
        $res = $stmtGet->fetch();
        $res['id'] = (string)$res['id'];
        $res['is_own'] = (bool)$res['is_own'];
        Response::json($res);
    }

    public static function deleteChannel(?string $id): void {
        AuthMiddleware::requireAuth();
        $idOrName = $id ?: ($_GET['id'] ?? $_GET['name'] ?? null);

        $pdo = Database::getConnection();
        if ($idOrName && is_numeric($idOrName)) {
            $stmt = $pdo->prepare("DELETE FROM channels WHERE id = ?");
            $stmt->execute([$idOrName]);
        } elseif ($idOrName) {
            $stmt = $pdo->prepare("DELETE FROM channels WHERE LOWER(name) = ?");
            $stmt->execute([strtolower($idOrName)]);
        }
        Response::json(['message' => 'Channel deleted']);
    }

    // --- DIRECTORS ---

    public static function listDirectors(): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT * FROM directors ORDER BY name ASC");
        $directors = array_map(function ($d) {
            $d['id'] = (string)$d['id'];
            $d['_id'] = (string)$d['id'];
            return $d;
        }, $stmt->fetchAll());
        Response::json($directors);
    }

    public static function createDirector(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $name = trim($data['name'] ?? '');
        if (!$name) Response::error('Name is required', 400);

        $phone = trim($data['phone'] ?? '');
        $photoUrl = trim($data['photo_url'] ?? '');
        $ownerId = $user['id'] ?? 'default_admin';

        $pdo = Database::getConnection();
        $stmtFind = $pdo->prepare("SELECT * FROM directors WHERE LOWER(name) = ? LIMIT 1");
        $stmtFind->execute([strtolower($name)]);
        $existing = $stmtFind->fetch();

        if ($existing) {
            $stmtUp = $pdo->prepare("UPDATE directors SET name = ?, phone = ?, photo_url = ? WHERE id = ?");
            $stmtUp->execute([$name, $phone ?: $existing['phone'], $photoUrl ?: $existing['photo_url'], $existing['id']]);

            $stmtGet = $pdo->prepare("SELECT * FROM directors WHERE id = ?");
            $stmtGet->execute([$existing['id']]);
            $res = $stmtGet->fetch();
            $res['id'] = (string)$res['id'];
            Response::json($res);
        }

        $stmtIns = $pdo->prepare("INSERT INTO directors (name, phone, photo_url, owner_id) VALUES (?, ?, ?, ?)");
        $stmtIns->execute([$name, $phone, $photoUrl, $ownerId]);
        $id = $pdo->lastInsertId();

        Response::json([
            'id'        => (string)$id,
            '_id'       => (string)$id,
            'name'      => $name,
            'phone'     => $phone,
            'photo_url' => $photoUrl,
            'owner_id'  => $ownerId
        ], 201);
    }

    public static function updateDirector(?string $id): void {
        AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $idOrName = $id ?: ($data['id'] ?? $data['name'] ?? null);

        $pdo = Database::getConnection();

        $director = null;
        if ($idOrName && is_numeric($idOrName)) {
            $stmt = $pdo->prepare("SELECT * FROM directors WHERE id = ? LIMIT 1");
            $stmt->execute([$idOrName]);
            $director = $stmt->fetch();
        }
        if (!$director && $idOrName) {
            $stmt = $pdo->prepare("SELECT * FROM directors WHERE LOWER(name) = ? LIMIT 1");
            $stmt->execute([strtolower($idOrName)]);
            $director = $stmt->fetch();
        }

        if (!$director) {
            self::createDirector();
            return;
        }

        $name = isset($data['name']) && trim($data['name']) ? trim($data['name']) : $director['name'];
        $phone = isset($data['phone']) ? trim($data['phone']) : $director['phone'];
        $photoUrl = isset($data['photo_url']) ? trim($data['photo_url']) : $director['photo_url'];

        $stmtUp = $pdo->prepare("UPDATE directors SET name = ?, phone = ?, photo_url = ? WHERE id = ?");
        $stmtUp->execute([$name, $phone, $photoUrl, $director['id']]);

        $stmtGet = $pdo->prepare("SELECT * FROM directors WHERE id = ?");
        $stmtGet->execute([$director['id']]);
        $res = $stmtGet->fetch();
        $res['id'] = (string)$res['id'];
        Response::json($res);
    }

    public static function deleteDirector(?string $id): void {
        AuthMiddleware::requireAuth();
        $idOrName = $id ?: ($_GET['id'] ?? $_GET['name'] ?? null);

        $pdo = Database::getConnection();
        if ($idOrName && is_numeric($idOrName)) {
            $stmt = $pdo->prepare("DELETE FROM directors WHERE id = ?");
            $stmt->execute([$idOrName]);
        } elseif ($idOrName) {
            $stmt = $pdo->prepare("DELETE FROM directors WHERE LOWER(name) = ?");
            $stmt->execute([strtolower($idOrName)]);
        }
        Response::json(['message' => 'Director deleted']);
    }

    // --- CLIENT PAYMENTS ---

    public static function listPayments(): void {
        $pdo = Database::getConnection();

        $where = [];
        $params = [];

        if (!empty($_GET['channel'])) {
            $where[] = "LOWER(channel) = ?";
            $params[] = strtolower(trim($_GET['channel']));
        }
        if (!empty($_GET['shooting_id'])) {
            $where[] = "shooting_id = ?";
            $params[] = $_GET['shooting_id'];
        }

        $sql = "SELECT * FROM client_payments";
        if ($where) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }
        $sql .= " ORDER BY received_at DESC, id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $result = array_map(function ($r) {
            $r['id'] = (string)$r['id'];
            $r['_id'] = (string)$r['id'];
            $r['amount'] = (float)$r['amount'];
            if (!empty($r['shooting_id'])) $r['shooting_id'] = (string)$r['shooting_id'];
            return $r;
        }, $rows);

        Response::json($result);
    }

    public static function createPayment(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $channel = trim($data['channel'] ?? '');
        $amount = (float)($data['amount'] ?? 0);
        $shootingId = !empty($data['shooting_id']) ? (int)$data['shooting_id'] : null;
        $receivedAt = !empty($data['received_at']) ? trim($data['received_at']) : date('Y-m-d');
        $method = trim($data['method'] ?? '');
        $note = trim($data['note'] ?? '');
        $ownerId = $user['id'] ?? 'default_admin';

        if (!$channel || $amount <= 0) {
            Response::error('Channel and amount are required', 400);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO client_payments (shooting_id, channel, amount, received_at, method, note, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$shootingId, $channel, $amount, $receivedAt, $method, $note, $ownerId]);
        $id = $pdo->lastInsertId();

        Response::json([
            'id'          => (string)$id,
            '_id'         => (string)$id,
            'shooting_id' => $shootingId ? (string)$shootingId : null,
            'channel'     => $channel,
            'amount'      => $amount,
            'received_at' => $receivedAt,
            'method'      => $method,
            'note'        => $note,
            'owner_id'    => $ownerId
        ], 201);
    }

    public static function deletePayment(string $id): void {
        AuthMiddleware::requireAuth();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM client_payments WHERE id = ?");
        $stmt->execute([$id]);
        Response::json(['message' => 'Payment deleted']);
    }

    // --- CHANNEL DUE SUMMARY ---

    public static function getChannelSummary(): void {
        $pdo = Database::getConnection();

        // 1. Get own channels
        $stmtOwn = $pdo->query("SELECT LOWER(TRIM(name)) as name FROM channels WHERE is_own = 1");
        $ownChannels = $stmtOwn->fetchAll(PDO::FETCH_COLUMN);
        $ownSet = array_flip($ownChannels);

        // 2. Collect unique external channel names from channels and shootings
        $stmtCh = $pdo->query("SELECT TRIM(name) as name FROM channels WHERE is_own = 0 AND name != ''");
        $channelsList = $stmtCh->fetchAll(PDO::FETCH_COLUMN);

        $stmtSh = $pdo->query("SELECT DISTINCT TRIM(channel) as name FROM shootings WHERE channel != ''");
        $shootChannels = $stmtSh->fetchAll(PDO::FETCH_COLUMN);

        $allUnique = [];
        foreach (array_merge($channelsList, $shootChannels) as $ch) {
            $key = strtolower(trim($ch));
            if (!isset($ownSet[$key]) && !isset($allUnique[$key])) {
                $allUnique[$key] = trim($ch);
            }
        }

        // 3. Aggregate contracts and payments for each external channel
        $summaries = [];
        foreach ($allUnique as $lowerName => $displayName) {
            // Shootings total contract & count
            $stmtS = $pdo->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(contract_amount), 0) as total FROM shootings WHERE LOWER(TRIM(channel)) = ?");
            $stmtS->execute([$lowerName]);
            $sData = $stmtS->fetch();

            $shootingCount = (int)$sData['cnt'];
            $contractTotal = (float)$sData['total'];

            // Payments total received
            $stmtP = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM client_payments WHERE LOWER(TRIM(channel)) = ?");
            $stmtP->execute([$lowerName]);
            $receivedTotal = (float)$stmtP->fetch()['total'];

            $dueTotal = $contractTotal - $receivedTotal;

            $summaries[] = [
                'channel'        => $displayName,
                'shooting_count' => $shootingCount,
                'contract_total' => round($contractTotal, 2),
                'received_total' => round($receivedTotal, 2),
                'due_total'      => round($dueTotal, 2),
            ];
        }

        usort($summaries, function ($a, $b) {
            return $b['due_total'] <=> $a['due_total'];
        });

        Response::json($summaries);
    }
}
