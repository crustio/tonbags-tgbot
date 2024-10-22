CREATE TABLE IF NOT EXISTS `file`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `uuid` varchar(64) NOT NULL,
  `chat_id` varchar(96) NOT NULL,
  `address` varchar(96) NOT NULL,
  `from` varchar(128) NOT NULL,
  `file_name` text NOT NULL,
  `file` text NOT NULL,
  `file_size` bigint NOT NULL,
  `upload_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `save_mode` varchar(16) NOT NULL DEFAULT '' COMMENT 'ton, crust',
  `cid` varchar(128) NULL,
  `bag_id` varchar(128) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_files_address`(`address`) USING BTREE,
  INDEX `idx_files_chat_id`(`chat_id`) USING BTREE,
  INDEX `idx_files_update_date`(`upload_date`) USING BTREE,
  UNIQUE INDEX `idx_files_uuid`(`uuid`) USING BTREE
);

CREATE TABLE IF NOT EXISTS `chat_mode`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `chat_id` varchar(96) NOT NULL,
  `save_mode` varchar(16) NOT NULL DEFAULT '' COMMENT 'ton, crust',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_chat_mode_chat_id`(`chat_id`) USING BTREE
);
