-- ==============================================================================
-- Royal Wellness Center — MySQL Database Schema DDL
-- Charset: utf8mb4 (Full Emoji, Sinhala & Tamil Multilingual Support)
-- Collation: utf8mb4_unicode_ci
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `royal_wellness_crm` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `royal_wellness_crm`;

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. Table: treatment_categories
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `treatment_categories`;
CREATE TABLE `treatment_categories` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `nameEn` VARCHAR(255) NOT NULL,
  `nameSi` VARCHAR(255) NOT NULL,
  `nameTa` VARCHAR(255) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `iconName` VARCHAR(100) NOT NULL DEFAULT 'Sparkles',
  `description` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Table: users (Staff, Super Admin & Coordinators)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(36) NOT NULL,
  `fullName` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(50) NULL,
  `role` ENUM('super_admin', 'coordinator') NOT NULL DEFAULT 'coordinator',
  `treatmentCategoryId` VARCHAR(50) NULL,
  `language` ENUM('en', 'si', 'ta') NOT NULL DEFAULT 'en',
  `avatar` VARCHAR(500) NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_users_category` FOREIGN KEY (`treatmentCategoryId`) REFERENCES `treatment_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Table: treatments (Clinical Treatment Catalog)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `treatments`;
CREATE TABLE `treatments` (
  `id` VARCHAR(50) NOT NULL,
  `categoryId` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `nameEn` VARCHAR(255) NOT NULL,
  `nameSi` VARCHAR(255) NOT NULL,
  `nameTa` VARCHAR(255) NOT NULL,
  `startingPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'LKR',
  `durationMinutes` INT NOT NULL DEFAULT 60,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `benefits` TEXT NULL,
  `description` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_treatments_category` (`categoryId`),
  CONSTRAINT `fk_treatments_category` FOREIGN KEY (`categoryId`) REFERENCES `treatment_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Table: customers (WhatsApp Direct Patients)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` VARCHAR(50) NOT NULL,
  `whatsappNumber` VARCHAR(50) NOT NULL UNIQUE,
  `whatsappId` VARCHAR(100) NULL,
  `phoneNumber` VARCHAR(50) NULL,
  `displayName` VARCHAR(255) NOT NULL,
  `preferredLanguage` ENUM('en', 'si', 'ta') NOT NULL DEFAULT 'en',
  `avatarUrl` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_customers_wa_number` (`whatsappNumber`),
  INDEX `idx_customers_wa_id` (`whatsappId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Table: leads (Patient Pipeline Enquiries)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `leads`;
CREATE TABLE `leads` (
  `id` VARCHAR(50) NOT NULL,
  `customerId` VARCHAR(50) NOT NULL,
  `categoryId` VARCHAR(50) NOT NULL,
  `treatmentId` VARCHAR(50) NOT NULL,
  `assignedTo` VARCHAR(36) NULL,
  `stage` ENUM('new', 'assigned', 'contacted', 'interested', 'follow_up', 'converted', 'lost') NOT NULL DEFAULT 'new',
  `source` VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  `language` ENUM('en', 'si', 'ta') NOT NULL DEFAULT 'en',
  `lastCustomerMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_leads_customer` (`customerId`),
  INDEX `idx_leads_category` (`categoryId`),
  INDEX `idx_leads_treatment` (`treatmentId`),
  INDEX `idx_leads_assigned` (`assignedTo`),
  INDEX `idx_leads_stage` (`stage`),
  CONSTRAINT `fk_leads_customer` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_leads_category` FOREIGN KEY (`categoryId`) REFERENCES `treatment_categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_leads_treatment` FOREIGN KEY (`treatmentId`) REFERENCES `treatments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_leads_user` FOREIGN KEY (`assignedTo`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. Table: messages (WhatsApp Chat Messages & Reactions)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `id` VARCHAR(100) NOT NULL,
  `leadId` VARCHAR(50) NOT NULL,
  `customerId` VARCHAR(50) NOT NULL,
  `direction` ENUM('inbound', 'outbound') NOT NULL,
  `senderType` ENUM('customer', 'coordinator', 'system', 'ai') NOT NULL,
  `content` TEXT NOT NULL,
  `status` ENUM('sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'sent',
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reaction` VARCHAR(50) NULL,
  `starred` BOOLEAN NOT NULL DEFAULT FALSE,
  `pinned` BOOLEAN NOT NULL DEFAULT FALSE,
  `replyToId` VARCHAR(100) NULL,
  `replyToContent` TEXT NULL,
  `replyToSender` VARCHAR(255) NULL,
  `mediaUrl` VARCHAR(500) NULL,
  `mediaType` VARCHAR(50) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_messages_lead` (`leadId`),
  INDEX `idx_messages_customer` (`customerId`),
  INDEX `idx_messages_timestamp` (`timestamp`),
  CONSTRAINT `fk_messages_lead` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_customer` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. Table: followups (Automated Sequences)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `followups`;
CREATE TABLE `followups` (
  `id` VARCHAR(50) NOT NULL,
  `leadId` VARCHAR(50) NOT NULL,
  `sequenceId` VARCHAR(50) NULL,
  `stepNumber` INT NOT NULL DEFAULT 1,
  `templateId` VARCHAR(50) NULL,
  `scheduledAt` DATETIME(3) NOT NULL,
  `status` ENUM('pending', 'sent', 'cancelled', 'paused') NOT NULL DEFAULT 'pending',
  `cancellationReason` VARCHAR(255) NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_followups_lead` (`leadId`),
  INDEX `idx_followups_schedule` (`status`, `scheduledAt`),
  CONSTRAINT `fk_followups_lead` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. Table: lead_notes (Internal Staff Clinical Annotations)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `lead_notes`;
CREATE TABLE `lead_notes` (
  `id` VARCHAR(50) NOT NULL,
  `leadId` VARCHAR(50) NOT NULL,
  `authorId` VARCHAR(36) NOT NULL,
  `authorName` VARCHAR(255) NOT NULL,
  `note` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_notes_lead` (`leadId`),
  INDEX `idx_notes_author` (`authorId`),
  CONSTRAINT `fk_notes_lead` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notes_author` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. Table: lead_stage_histories (Stage Audit Pipeline)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `lead_stage_histories`;
CREATE TABLE `lead_stage_histories` (
  `id` VARCHAR(50) NOT NULL,
  `leadId` VARCHAR(50) NOT NULL,
  `fromStage` ENUM('new', 'assigned', 'contacted', 'interested', 'follow_up', 'converted', 'lost') NOT NULL,
  `toStage` ENUM('new', 'assigned', 'contacted', 'interested', 'follow_up', 'converted', 'lost') NOT NULL,
  `changedById` VARCHAR(36) NOT NULL,
  `changedByName` VARCHAR(255) NOT NULL,
  `reason` VARCHAR(500) NULL,
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_stage_hist_lead` (`leadId`),
  INDEX `idx_stage_hist_user` (`changedById`),
  CONSTRAINT `fk_stage_hist_lead` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stage_hist_user` FOREIGN KEY (`changedById`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. Table: audit_logs (System Governance)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` VARCHAR(50) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entityType` VARCHAR(100) NOT NULL,
  `entityId` VARCHAR(100) NOT NULL,
  `performedById` VARCHAR(36) NULL,
  `performedByName` VARCHAR(255) NULL,
  `previousValue` TEXT NULL,
  `newValue` TEXT NULL,
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_audit_entity` (`entityType`, `entityId`),
  INDEX `idx_audit_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 11. Table: whatsapp_templates (Pre-Approved Meta HSM Templates)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `whatsapp_templates`;
CREATE TABLE `whatsapp_templates` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `language` ENUM('en', 'si', 'ta') NOT NULL DEFAULT 'en',
  `content` TEXT NOT NULL,
  `header` VARCHAR(255) NULL,
  `footer` VARCHAR(255) NULL,
  `buttonsJson` TEXT NULL,
  `status` ENUM('APPROVED', 'PENDING', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
