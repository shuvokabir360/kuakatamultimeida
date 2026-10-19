-- ============================================================
-- Kuakata Multimedia Finance - Complete MySQL Database Schema
-- Compatible with phpMyAdmin, MySQL 5.7+, MySQL 8.0+, MariaDB 10+
-- Collation: utf8mb4_unicode_ci
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Table: users (Admin & Managers)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(191) NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(150) DEFAULT 'Admin',
  `role` ENUM('admin', 'manager', 'viewer') DEFAULT 'admin',
  `phone` VARCHAR(50) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: members (Daily & Monthly Members)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) DEFAULT '',
  `role` VARCHAR(100) DEFAULT '',
  `type` ENUM('daily', 'monthly') NOT NULL DEFAULT 'daily',
  `rate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `photo_url` TEXT DEFAULT NULL,
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: shootings (Production & Shooting Schedules)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shootings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `shoot_date` VARCHAR(20) NOT NULL UNIQUE,
  `director` VARCHAR(150) DEFAULT '',
  `channel` VARCHAR(150) DEFAULT '',
  `contract_amount` DECIMAL(12, 2) DEFAULT 0.00,
  `location` VARCHAR(255) DEFAULT '',
  `note` TEXT DEFAULT NULL,
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: attendance (Member Attendance Tracking)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `present` TINYINT(1) DEFAULT 1,
  `shooting_id` INT NULL,
  `rate_override` DECIMAL(12, 2) DEFAULT NULL,
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_member_date` (`member_id`, `date`),
  KEY `idx_att_date` (`date`),
  KEY `idx_att_shooting` (`shooting_id`),
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`shooting_id`) REFERENCES `shootings` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: payments (Member Payment Cash/Bank Out)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `note` TEXT DEFAULT NULL,
  `paid_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_pay_member` (`member_id`),
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: bonuses (Member Bonuses / Tips)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bonuses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `reason` TEXT DEFAULT NULL,
  `given_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_bonus_member` (`member_id`),
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: monthly_salaries (Fixed Monthly Salary Register)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `monthly_salaries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `month` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_member_month` (`member_id`, `month`),
  FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: shooting_expenses (Extra Shooting Production Costs)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shooting_expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shooting_id` INT NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `note` TEXT DEFAULT NULL,
  `spent_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_expense_shooting` (`shooting_id`),
  FOREIGN KEY (`shooting_id`) REFERENCES `shootings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: channels (YouTube / Production Channels)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `channels` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL UNIQUE,
  `is_own` TINYINT(1) DEFAULT 0,
  `logo_url` TEXT DEFAULT NULL,
  `color` VARCHAR(50) DEFAULT '',
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: directors (Directors Register)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `directors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL UNIQUE,
  `phone` VARCHAR(50) DEFAULT '',
  `photo_url` TEXT DEFAULT NULL,
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: client_payments (Payments Received from External Clients)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `client_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shooting_id` INT NULL,
  `channel` VARCHAR(150) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `received_at` VARCHAR(20) DEFAULT NULL,
  `method` VARCHAR(100) DEFAULT '',
  `note` TEXT DEFAULT NULL,
  `owner_id` VARCHAR(100) DEFAULT 'default_admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_cp_channel` (`channel`),
  KEY `idx_cp_shooting` (`shooting_id`),
  FOREIGN KEY (`shooting_id`) REFERENCES `shootings` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: sms_otps (SMS OTP Records for Member Profile Lookups)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sms_otps` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(50) NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `verified` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Seed Default Admin User: adminkm / 01747729757@SK
-- Password hash generated with bcrypt (cost 10)
-- --------------------------------------------------------
INSERT INTO `users` (`username`, `email`, `password`, `name`, `role`, `phone`)
VALUES (
  'adminkm',
  'adminkm@kuakatamedia.com',
  '$2y$10$iI8Y2wU.Hh929mZt.i333e.8V8a2N6Uo92w55fR4X6uIe8A9C1iF2',
  'Admin KM',
  'admin',
  '01747729757'
)
ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

-- --------------------------------------------------------
-- Seed All 19 Members
-- --------------------------------------------------------
INSERT IGNORE INTO `members` (`name`, `role`, `type`, `rate`, `phone`, `owner_id`) VALUES
('Kabir Hossen Shuvo', 'CEO', 'monthly', 0, '01713953527', 'default_admin'),
('Badal', 'Production', 'daily', 0, '', 'default_admin'),
('Noyon Moni', 'Production', 'daily', 0, '', 'default_admin'),
('Jafor Howlader', 'Actor', 'daily', 0, '', 'default_admin'),
('Abu Hasan Milon', 'Actor', 'daily', 0, '', 'default_admin'),
('Sojib', 'Production', 'daily', 0, '', 'default_admin'),
('Bayzid', 'Production', 'daily', 0, '', 'default_admin'),
('Toha', 'Actor', 'daily', 0, '', 'default_admin'),
('Tamanna', 'Actor', 'daily', 0, '', 'default_admin'),
('Rimi', 'Actor', 'daily', 0, '', 'default_admin'),
('Jisan Musulli', 'Actor', 'daily', 0, '', 'default_admin'),
('Emon Molla', 'Actor', 'daily', 0, '', 'default_admin'),
('Siraj Musulli', 'Actor', 'daily', 0, '', 'default_admin'),
('Ziaur Rahman', 'Editor & Cameraman', 'monthly', 0, '', 'default_admin'),
('Porosh Moni', 'Editor & Cameraman', 'monthly', 0, '01610400509', 'default_admin'),
('Arif Apon', 'Actor', 'daily', 0, '', 'default_admin'),
('Masud Pervez Sagar', 'Actor', 'daily', 0, '', 'default_admin'),
('SM Almas', 'Actor & Director', 'daily', 0, '', 'default_admin'),
('Abubakar Abir', 'Ass. Director', 'monthly', 0, '01713953527', 'default_admin');

SET FOREIGN_KEY_CHECKS = 1;
