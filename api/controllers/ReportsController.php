<?php
/**
 * Reports Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class ReportsController {
    public static function getSummary(): void {
        $pdo = Database::getConnection();

        $from = $_GET['from'] ?? null;
        $to = $_GET['to'] ?? null;

        // 1. Members
        $totalMembers = (int)$pdo->query("SELECT COUNT(*) FROM members")->fetchColumn();
        $dailyMembers = (int)$pdo->query("SELECT COUNT(*) FROM members WHERE type = 'daily'")->fetchColumn();
        $monthlyMembers = (int)$pdo->query("SELECT COUNT(*) FROM members WHERE type = 'monthly'")->fetchColumn();

        // 2. Attendance
        $attWhere = ["a.present = 1"];
        $attParams = [];
        if ($from) {
            $attWhere[] = "a.date >= ?";
            $attParams[] = $from;
        }
        if ($to) {
            $attWhere[] = "a.date <= ?";
            $attParams[] = $to;
        }

        $sqlAtt = "SELECT a.rate_override, m.rate as member_rate 
                   FROM attendance a 
                   LEFT JOIN members m ON a.member_id = m.id
                   WHERE " . implode(" AND ", $attWhere);
        $stmtAtt = $pdo->prepare($sqlAtt);
        $stmtAtt->execute($attParams);
        $attendances = $stmtAtt->fetchAll();

        $attCount = count($attendances);
        $attCost = 0.0;
        foreach ($attendances as $a) {
            if ($a['rate_override'] !== null && is_numeric($a['rate_override'])) {
                $attCost += (float)$a['rate_override'];
            } elseif ($a['member_rate'] !== null) {
                $attCost += (float)$a['member_rate'];
            }
        }

        // 3. Payments
        $payWhere = [];
        $payParams = [];
        if ($from) {
            $payWhere[] = "paid_at >= ?";
            $payParams[] = $from;
        }
        if ($to) {
            $payWhere[] = "paid_at <= ?";
            $payParams[] = $to . ' 23:59:59';
        }
        $sqlPay = "SELECT COALESCE(SUM(amount), 0) FROM payments";
        if ($payWhere) $sqlPay .= " WHERE " . implode(" AND ", $payWhere);
        $stmtPay = $pdo->prepare($sqlPay);
        $stmtPay->execute($payParams);
        $totalPaid = (float)$stmtPay->fetchColumn();

        // 4. Bonuses
        $bonWhere = [];
        $bonParams = [];
        if ($from) {
            $bonWhere[] = "given_at >= ?";
            $bonParams[] = $from;
        }
        if ($to) {
            $bonWhere[] = "given_at <= ?";
            $bonParams[] = $to . ' 23:59:59';
        }
        $sqlBon = "SELECT COALESCE(SUM(amount), 0) FROM bonuses";
        if ($bonWhere) $sqlBon .= " WHERE " . implode(" AND ", $bonWhere);
        $stmtBon = $pdo->prepare($sqlBon);
        $stmtBon->execute($bonParams);
        $totalBonuses = (float)$stmtBon->fetchColumn();

        // 5. Shooting Expenses
        $expWhere = [];
        $expParams = [];
        if ($from) {
            $expWhere[] = "spent_at >= ?";
            $expParams[] = $from;
        }
        if ($to) {
            $expWhere[] = "spent_at <= ?";
            $expParams[] = $to . ' 23:59:59';
        }
        $sqlExp = "SELECT COALESCE(SUM(amount), 0) FROM shooting_expenses";
        if ($expWhere) $sqlExp .= " WHERE " . implode(" AND ", $expWhere);
        $stmtExp = $pdo->prepare($sqlExp);
        $stmtExp->execute($expParams);
        $totalExpenses = (float)$stmtExp->fetchColumn();

        // 6. Shootings Count
        $shWhere = [];
        $shParams = [];
        if ($from) {
            $shWhere[] = "shoot_date >= ?";
            $shParams[] = $from;
        }
        if ($to) {
            $shWhere[] = "shoot_date <= ?";
            $shParams[] = $to;
        }
        $sqlSh = "SELECT COUNT(*) FROM shootings";
        if ($shWhere) $sqlSh .= " WHERE " . implode(" AND ", $shWhere);
        $stmtSh = $pdo->prepare($sqlSh);
        $stmtSh->execute($shParams);
        $totalShootings = (int)$stmtSh->fetchColumn();

        Response::json([
            'members'    => [
                'total'   => $totalMembers,
                'daily'   => $dailyMembers,
                'monthly' => $monthlyMembers
            ],
            'attendance' => [
                'count' => $attCount,
                'cost'  => round($attCost, 2)
            ],
            'payments'   => [
                'total' => round($totalPaid, 2)
            ],
            'bonuses'    => [
                'total' => round($totalBonuses, 2)
            ],
            'expenses'   => [
                'total' => round($totalExpenses, 2)
            ],
            'shootings'  => [
                'count' => $totalShootings
            ],
        ]);
    }
}
