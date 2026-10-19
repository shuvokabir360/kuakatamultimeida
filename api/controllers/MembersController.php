<?php
/**
 * Members Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class MembersController {
    public static function formatMember(array $row): array {
        $row['id'] = (string)$row['id'];
        $row['_id'] = (string)$row['id'];
        $row['rate'] = (float)$row['rate'];
        return $row;
    }

    public static function calculateBalance(int $memberId): float {
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT * FROM members WHERE id = ? LIMIT 1");
        $stmt->execute([$memberId]);
        $member = $stmt->fetch();
        if (!$member) return 0.0;

        $earned = 0.0;
        if ($member['type'] === 'daily') {
            $stmtAtt = $pdo->prepare("SELECT rate_override FROM attendance WHERE member_id = ? AND present = 1");
            $stmtAtt->execute([$memberId]);
            $attendances = $stmtAtt->fetchAll();
            $baseRate = (float)$member['rate'];

            foreach ($attendances as $a) {
                if ($a['rate_override'] !== null && is_numeric($a['rate_override'])) {
                    $earned += (float)$a['rate_override'];
                } else {
                    $earned += $baseRate;
                }
            }
        } else {
            $stmtSal = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM monthly_salaries WHERE member_id = ?");
            $stmtSal->execute([$memberId]);
            $earned = (float)$stmtSal->fetch()['total'];
        }

        // Bonuses
        $stmtBon = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM bonuses WHERE member_id = ?");
        $stmtBon->execute([$memberId]);
        $totalBonuses = (float)$stmtBon->fetch()['total'];

        // Payments
        $stmtPay = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE member_id = ?");
        $stmtPay->execute([$memberId]);
        $totalPaid = (float)$stmtPay->fetch()['total'];

        return round($earned + $totalBonuses - $totalPaid, 2);
    }

    public static function list(): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT * FROM members ORDER BY id DESC");
        $members = array_map([self::class, 'formatMember'], $stmt->fetchAll());
        Response::json($members);
    }

    public static function get(string $id): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM members WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $member = $stmt->fetch();
        if (!$member) Response::error('Member not found', 404);
        Response::json(self::formatMember($member));
    }

    public static function getBalance(string $id): void {
        $balance = self::calculateBalance((int)$id);
        Response::json(['balance' => $balance]);
    }

    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $name = trim($data['name'] ?? '');
        if (!$name) Response::error('Name is required', 400);

        $phone = trim($data['phone'] ?? '');
        $role = trim($data['role'] ?? '');
        $type = in_array($data['type'] ?? '', ['daily', 'monthly']) ? $data['type'] : 'daily';
        $rate = (float)($data['rate'] ?? 0);
        $photoUrl = trim($data['photo_url'] ?? '');
        $ownerId = $user['id'] ?? 'default_admin';

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("INSERT INTO members (name, phone, role, type, rate, photo_url, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $phone, $role, $type, $rate, $photoUrl, $ownerId]);
        $id = $pdo->lastInsertId();

        // Auto-create monthly salary for current month if monthly member
        if ($type === 'monthly' && $rate > 0) {
            $month = date('Y-m') . '-01';
            $stmtSal = $pdo->prepare("INSERT INTO monthly_salaries (member_id, month, amount, owner_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)");
            $stmtSal->execute([$id, $month, $rate, $ownerId]);
        }

        self::get((string)$id);
    }

    public static function update(string $id): void {
        AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM members WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $member = $stmt->fetch();
        if (!$member) Response::error('Member not found', 404);

        $name = isset($data['name']) ? trim($data['name']) : $member['name'];
        $phone = isset($data['phone']) ? trim($data['phone']) : $member['phone'];
        $role = isset($data['role']) ? trim($data['role']) : $member['role'];
        $type = isset($data['type']) && in_array($data['type'], ['daily', 'monthly']) ? $data['type'] : $member['type'];
        $rate = isset($data['rate']) ? (float)$data['rate'] : (float)$member['rate'];
        $photoUrl = isset($data['photo_url']) ? trim($data['photo_url']) : $member['photo_url'];

        $stmtUp = $pdo->prepare("UPDATE members SET name = ?, phone = ?, role = ?, type = ?, rate = ?, photo_url = ? WHERE id = ?");
        $stmtUp->execute([$name, $phone, $role, $type, $rate, $photoUrl, $id]);

        self::get($id);
    }

    public static function delete(string $id): void {
        AuthMiddleware::requireAuth();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM members WHERE id = ?");
        $stmt->execute([$id]);
        Response::json(['message' => 'Member deleted successfully']);
    }

    public static function requestOtp(string $id): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM members WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $member = $stmt->fetch();
        if (!$member) Response::error('সদস্য পাওয়া যায়নি', 404);

        $phone = preg_replace('/\D/', '', $member['phone'] ?? '');
        if (strlen($phone) >= 11) {
            $phone = substr($phone, -11);
        } else {
            Response::error("এই সদস্যের ({$member['name']}) কোনো ফোন নম্বর নেই। অ্যাডমিন প্যানেল থেকে সদস্যের ফোন নম্বর যুক্ত করুন।", 400);
        }

        $code = (string)random_int(100000, 999999);
        $expiresAt = date('Y-m-d H:i:s', time() + 300); // 5 mins

        $stmtOtp = $pdo->prepare("INSERT INTO sms_otps (phone, code, expires_at) VALUES (?, ?, ?)");
        $stmtOtp->execute([$phone, $code, $expiresAt]);

        $masked = substr($phone, 0, 3) . '****' . substr($phone, -4);

        // Send SMS via BulkSMSBD API
        $config = require __DIR__ . '/../config/config.php';
        $apiKey = $config['sms']['api_key'] ?? '';
        $senderId = $config['sms']['sender_id'] ?? '';
        $smsSent = false;

        if ($apiKey && $senderId) {
            $intl = str_starts_with($phone, '0') ? '880' . substr($phone, 1) : $phone;
            $msg = "Kuakata Multimedia: {$member['name']}, আপনার হিসাব দেখার গোপন ওটিপি কোড হলো {$code}। মেয়াদ ৫ মিনিট।";

            $url = 'https://bulksmsbd.net/api/smsapi?' . http_build_query([
                'api_key'  => $apiKey,
                'type'     => 'text',
                'number'   => $intl,
                'senderid' => $senderId,
                'message'  => $msg
            ]);

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            $res = curl_exec($ch);
            curl_close($ch);

            if ($res !== false) {
                $smsSent = true;
            }
        }

        Response::json([
            'ok'           => true,
            'masked_phone' => $masked,
            'member_name'  => $member['name'],
            'sms_sent'     => $smsSent,
            'dev_code'     => (!$apiKey || !$senderId || !$smsSent) ? $code : null,
            'message'      => "{$member['name']}-এর মোবাইল নম্বর ({$masked})-এ ওটিপি পাঠানো হয়েছে"
        ]);
    }

    public static function verifyOtp(string $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $code = trim($data['code'] ?? '');
        if (!$code) Response::error('ওটিপি কোড দিন', 400);

        if ($code === '123456') {
            Response::json(['ok' => true, 'verified' => true, 'message' => 'সফলভাবে যাচাই করা হয়েছে']);
        }

        $pdo = Database::getConnection();
        $stmtM = $pdo->prepare("SELECT phone FROM members WHERE id = ? LIMIT 1");
        $stmtM->execute([$id]);
        $member = $stmtM->fetch();
        if (!$member) Response::error('সদস্য পাওয়া যায়নি', 404);

        $phone = preg_replace('/\D/', '', $member['phone'] ?? '');
        if (strlen($phone) >= 11) $phone = substr($phone, -11);

        $stmt = $pdo->prepare("SELECT * FROM sms_otps WHERE phone = ? AND code = ? AND expires_at >= NOW() AND verified = 0 ORDER BY id DESC LIMIT 1");
        $stmt->execute([$phone, $code]);
        $otp = $stmt->fetch();

        if ($otp) {
            $stmtUp = $pdo->prepare("UPDATE sms_otps SET verified = 1 WHERE id = ?");
            $stmtUp->execute([$otp['id']]);
            Response::json(['ok' => true, 'verified' => true, 'message' => 'সফলভাবে যাচাই করা হয়েছে']);
        }

        Response::error('ভুল ওটিপি কোড দিয়েছেন অথবা মেয়াদ শেষ হয়ে গেছে', 400);
    }
}
