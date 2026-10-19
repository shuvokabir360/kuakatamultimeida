<?php
/**
 * Kuakata Multimedia Finance - PHP API Front Controller
 * Handles all REST API endpoints for Frontend and Mobile Apps
 */

// Global CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/utils/response.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/MembersController.php';
require_once __DIR__ . '/controllers/AttendanceController.php';
require_once __DIR__ . '/controllers/PaymentsController.php';
require_once __DIR__ . '/controllers/ShootingsController.php';
require_once __DIR__ . '/controllers/ClientsController.php';
require_once __DIR__ . '/controllers/ReportsController.php';
require_once __DIR__ . '/controllers/UploadController.php';

// Extract URI path
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$scriptName = dirname($_SERVER['SCRIPT_NAME']);

// Remove base path to get route relative to /api
$path = '/' . trim(str_replace(['/api', $scriptName], '', $requestUri), '/');
$method = $_SERVER['REQUEST_METHOD'];

// Handle health check
if ($path === '/' || $path === '/health') {
    Response::json([
        'status'   => 'ok',
        'database' => 'MySQL (phpMyAdmin)',
        'backend'  => 'PHP ' . PHP_VERSION,
        'time'     => date('c')
    ]);
}

// -------------------------------------------------------------
// Route Dispatcher
// -------------------------------------------------------------

// --- AUTH ---
if ($method === 'POST' && $path === '/auth/login') {
    AuthController::login();
}
if ($method === 'POST' && $path === '/auth/register') {
    AuthController::register();
}
if ($method === 'GET' && $path === '/auth/me') {
    AuthController::me();
}
if ($method === 'GET' && $path === '/auth/has-role') {
    AuthController::hasRole();
}
if ($method === 'POST' && $path === '/auth/verify-password') {
    AuthController::verifyPassword();
}

// --- MEMBERS ---
if ($method === 'GET' && $path === '/members') {
    MembersController::list();
}
if ($method === 'POST' && $path === '/members') {
    MembersController::create();
}
if (preg_match('#^/members/([0-9a-zA-Z_-]+)/balance$#', $path, $m)) {
    MembersController::getBalance($m[1]);
}
if (preg_match('#^/members/([0-9a-zA-Z_-]+)/request-otp$#', $path, $m)) {
    MembersController::requestOtp($m[1]);
}
if (preg_match('#^/members/([0-9a-zA-Z_-]+)/verify-otp$#', $path, $m)) {
    MembersController::verifyOtp($m[1]);
}
if (preg_match('#^/members/([0-9a-zA-Z_-]+)$#', $path, $m)) {
    if ($method === 'GET') MembersController::get($m[1]);
    if ($method === 'PUT') MembersController::update($m[1]);
    if ($method === 'DELETE') MembersController::delete($m[1]);
}

// --- ATTENDANCE ---
if ($path === '/attendance') {
    if ($method === 'GET') AttendanceController::list();
    if ($method === 'POST') AttendanceController::mark();
    if ($method === 'DELETE') AttendanceController::delete(null);
}
if ($method === 'POST' && $path === '/attendance/bulk') {
    AttendanceController::bulkMark();
}
if (preg_match('#^/attendance/([0-9a-zA-Z_-]+)$#', $path, $m)) {
    if ($method === 'DELETE') AttendanceController::delete($m[1]);
}

// --- PAYMENTS, BONUSES & SALARIES ---
if ($path === '/payments') {
    if ($method === 'GET') PaymentsController::list();
    if ($method === 'POST') PaymentsController::create();
}
if (preg_match('#^/payments/bonuses/([0-9a-zA-Z_-]+)$#', $path, $m)) {
    if ($method === 'DELETE') PaymentsController::deleteBonus($m[1]);
}
if ($path === '/payments/bonuses') {
    if ($method === 'GET') PaymentsController::listBonuses();
    if ($method === 'POST') PaymentsController::createBonus();
}
if ($path === '/payments/salaries') {
    if ($method === 'GET') PaymentsController::listSalaries();
    if ($method === 'POST') PaymentsController::saveSalary();
}
if (preg_match('#^/payments/([0-9a-zA-Z_-]+)$#', $path, $m)) {
    if ($method === 'DELETE') PaymentsController::delete($m[1]);
}

// --- SHOOTINGS & EXPENSES ---
if ($path === '/shootings') {
    if ($method === 'GET') ShootingsController::list();
    if ($method === 'POST') ShootingsController::create();
}
if (preg_match('#^/shootings/([0-9a-zA-Z_-]+)/summary$#', $path, $m)) {
    if ($method === 'GET') ShootingsController::getSummary($m[1]);
}
if (preg_match('#^/shootings/([0-9a-zA-Z_-]+)/expenses$#', $path, $m)) {
    if ($method === 'GET') ShootingsController::listExpenses($m[1]);
    if ($method === 'POST') ShootingsController::addExpense($m[1]);
}
if (preg_match('#^/shootings/expenses/([0-9a-zA-Z_-]+)$#', $path, $m)) {
    if ($method === 'DELETE') ShootingsController::deleteExpense($m[1]);
}
if (preg_match('#^/shootings/([0-9a-zA-Z_-]+)$#', $path, $m)) {
    if ($method === 'PUT') ShootingsController::update($m[1]);
    if ($method === 'DELETE') ShootingsController::delete($m[1]);
}

// --- CLIENTS & CHANNELS ---
if ($path === '/clients/channels') {
    if ($method === 'GET') ClientsController::listChannels();
    if ($method === 'POST') ClientsController::createChannel();
    if ($method === 'PUT') ClientsController::updateChannel(null);
    if ($method === 'DELETE') ClientsController::deleteChannel(null);
}
if (preg_match('#^/clients/channels/([0-9a-zA-Z_-]+)$#', $path, $m)) {
    if ($method === 'PUT') ClientsController::updateChannel($m[1]);
    if ($method === 'DELETE') ClientsController::deleteChannel($m[1]);
}

if ($path === '/clients/directors') {
    if ($method === 'GET') ClientsController::listDirectors();
    if ($method === 'POST') ClientsController::createDirector();
    if ($method === 'PUT') ClientsController::updateDirector(null);
    if ($method === 'DELETE') ClientsController::deleteDirector(null);
}
if (preg_match('#^/clients/directors/([0-9a-zA-Z_-]+)$#', $path, $m)) {
    if ($method === 'PUT') ClientsController::updateDirector($m[1]);
    if ($method === 'DELETE') ClientsController::deleteDirector($m[1]);
}

if ($path === '/clients/payments') {
    if ($method === 'GET') ClientsController::listPayments();
    if ($method === 'POST') ClientsController::createPayment();
}
if (preg_match('#^/clients/payments/([0-9a-zA-Z_-]+)$#', $path, $m)) {
    if ($method === 'DELETE') ClientsController::deletePayment($m[1]);
}

if ($path === '/clients/channel-summary') {
    if ($method === 'GET') ClientsController::getChannelSummary();
}

// --- REPORTS ---
if ($path === '/reports/summary') {
    if ($method === 'GET') ReportsController::getSummary();
}

// --- UPLOAD ---
if ($method === 'POST' && $path === '/upload') {
    UploadController::upload();
}

// Not Found
Response::error("Route not found: {$method} {$path}", 404);
