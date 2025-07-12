# Backup Infrastructure for n8n-MCP Disaster Recovery

# S3 Buckets for Backups with Cross-Region Replication
resource "aws_s3_bucket" "backup_primary" {
  provider = aws.primary
  bucket   = "${var.project_name}-backups-${var.primary_region}"
  
  tags = {
    Name        = "${var.project_name}-backups-primary"
    Environment = var.environment
    Purpose     = "backup-storage"
  }
}

# Enable versioning for backup bucket
resource "aws_s3_bucket_versioning" "backup_primary" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption for backup bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_primary" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.backup_key.arn
    }
    bucket_key_enabled = true
  }
}

# Lifecycle rules for backup management
resource "aws_s3_bucket_lifecycle_configuration" "backup_primary" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id
  
  rule {
    id     = "transition-to-glacier"
    status = "Enabled"
    
    transition {
      days          = 30
      storage_class = "GLACIER"
    }
    
    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }
  }
  
  rule {
    id     = "expire-old-backups"
    status = "Enabled"
    
    expiration {
      days = 365
    }
    
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Object Lock for immutability (ransomware protection)
resource "aws_s3_bucket_object_lock_configuration" "backup_primary" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id
  
  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = 30
    }
  }
}

# Secondary region backup bucket
resource "aws_s3_bucket" "backup_secondary" {
  provider = aws.secondary
  bucket   = "${var.project_name}-backups-${var.secondary_region}"
  
  tags = {
    Name        = "${var.project_name}-backups-secondary"
    Environment = var.environment
    Purpose     = "backup-storage-replica"
  }
}

resource "aws_s3_bucket_versioning" "backup_secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.backup_secondary.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# Replication configuration
resource "aws_s3_bucket_replication_configuration" "backup_replication" {
  provider = aws.primary
  
  role   = aws_iam_role.replication_role.arn
  bucket = aws_s3_bucket.backup_primary.id
  
  rule {
    id       = "replicate-all-backups"
    status   = "Enabled"
    priority = 1
    
    filter {}
    
    destination {
      bucket        = aws_s3_bucket.backup_secondary.arn
      storage_class = "GLACIER_IR"
      
      replication_time {
        status = "Enabled"
        time {
          minutes = 15
        }
      }
      
      metrics {
        status = "Enabled"
        event_threshold {
          minutes = 15
        }
      }
    }
    
    delete_marker_replication {
      status = "Enabled"
    }
  }
  
  depends_on = [aws_s3_bucket_versioning.backup_primary]
}

# KMS keys for backup encryption
resource "aws_kms_key" "backup_key" {
  provider                = aws.primary
  description             = "KMS key for ${var.project_name} backup encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  
  tags = {
    Name    = "${var.project_name}-backup-key"
    Purpose = "backup-encryption"
  }
}

resource "aws_kms_alias" "backup_key" {
  provider      = aws.primary
  name          = "alias/${var.project_name}-backup"
  target_key_id = aws_kms_key.backup_key.key_id
}

# KMS key policy
resource "aws_kms_key_policy" "backup_key" {
  provider = aws.primary
  key_id   = aws_kms_key.backup_key.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow use of the key for S3"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow backup service to use the key"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.backup_role.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM role for backup operations
resource "aws_iam_role" "backup_role" {
  provider = aws.primary
  name     = "${var.project_name}-backup-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      },
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for backup operations
resource "aws_iam_role_policy" "backup_policy" {
  provider = aws.primary
  name     = "${var.project_name}-backup-policy"
  role     = aws_iam_role.backup_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:GetBucketVersioning"
        ]
        Resource = [
          aws_s3_bucket.backup_primary.arn,
          aws_s3_bucket.backup_secondary.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.backup_primary.arn}/*",
          "${aws_s3_bucket.backup_secondary.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.backup_key.arn
      },
      {
        Effect = "Allow"
        Action = [
          "rds:CreateDBSnapshot",
          "rds:DescribeDBSnapshots",
          "rds:CopyDBSnapshot",
          "rds:DeleteDBSnapshot",
          "rds:RestoreDBInstanceFromDBSnapshot"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:CreateSecret",
          "secretsmanager:UpdateSecret"
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:backup-keys/*"
      }
    ]
  })
}

# IAM role for S3 replication
resource "aws_iam_role" "replication_role" {
  provider = aws.primary
  name     = "${var.project_name}-s3-replication-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "replication_policy" {
  provider = aws.primary
  name     = "${var.project_name}-s3-replication-policy"
  role     = aws_iam_role.replication_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.backup_primary.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = "${aws_s3_bucket.backup_primary.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = "${aws_s3_bucket.backup_secondary.arn}/*"
      }
    ]
  })
}

# AWS Backup Plan
resource "aws_backup_plan" "main" {
  provider = aws.primary
  name     = "${var.project_name}-backup-plan"
  
  rule {
    rule_name         = "daily_backups"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 2 * * ? *)" # 2 AM UTC daily
    
    lifecycle {
      delete_after = 30
      cold_storage_after = 7
    }
    
    recovery_point_tags = {
      Frequency = "daily"
    }
  }
  
  rule {
    rule_name         = "weekly_backups"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 ? * SUN *)" # 3 AM UTC on Sundays
    
    lifecycle {
      delete_after = 90
      cold_storage_after = 30
    }
    
    recovery_point_tags = {
      Frequency = "weekly"
    }
  }
  
  rule {
    rule_name         = "monthly_backups"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 4 1 * ? *)" # 4 AM UTC on 1st of month
    
    lifecycle {
      delete_after = 365
      cold_storage_after = 90
    }
    
    recovery_point_tags = {
      Frequency = "monthly"
    }
  }
}

# Backup Vault
resource "aws_backup_vault" "main" {
  provider        = aws.primary
  name            = "${var.project_name}-backup-vault"
  kms_key_arn     = aws_kms_key.backup_key.arn
  
  tags = {
    Name = "${var.project_name}-backup-vault"
  }
}

# Backup Vault Lock (for compliance)
resource "aws_backup_vault_lock_configuration" "main" {
  provider            = aws.primary
  backup_vault_name   = aws_backup_vault.main.name
  
  min_retention_days  = 7
  max_retention_days  = 365
  
  changeable_for_days = 3
}

# Backup selection
resource "aws_backup_selection" "main" {
  provider     = aws.primary
  name         = "${var.project_name}-backup-selection"
  plan_id      = aws_backup_plan.main.id
  iam_role_arn = aws_iam_role.backup_role.arn
  
  resources = [
    "arn:aws:rds:*:*:cluster:${var.project_name}-*",
    "arn:aws:dynamodb:*:*:table/${var.project_name}-*",
    "arn:aws:ec2:*:*:volume/*"
  ]
  
  selection_tag {
    type  = "STRINGEQUALS"
    key   = "Backup"
    value = "true"
  }
}

# SNS topic for backup notifications
resource "aws_sns_topic" "backup_notifications" {
  provider = aws.primary
  name     = "${var.project_name}-backup-notifications"
  
  kms_master_key_id = aws_kms_key.backup_key.id
}

resource "aws_sns_topic_subscription" "backup_email" {
  provider  = aws.primary
  topic_arn = aws_sns_topic.backup_notifications.arn
  protocol  = "email"
  endpoint  = var.backup_notification_email
}

# EventBridge rule for backup events
resource "aws_cloudwatch_event_rule" "backup_events" {
  provider    = aws.primary
  name        = "${var.project_name}-backup-events"
  description = "Capture backup events"
  
  event_pattern = jsonencode({
    source = ["aws.backup"]
    detail-type = [
      "Backup Job State Change",
      "Restore Job State Change"
    ]
    detail = {
      state = [
        "COMPLETED",
        "FAILED",
        "EXPIRED"
      ]
    }
  })
}

resource "aws_cloudwatch_event_target" "backup_sns" {
  provider  = aws.primary
  rule      = aws_cloudwatch_event_rule.backup_events.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.backup_notifications.arn
}

# CloudWatch Log Group for backup logs
resource "aws_cloudwatch_log_group" "backup_logs" {
  provider          = aws.primary
  name              = "/aws/backup/${var.project_name}"
  retention_in_days = 30
  
  kms_key_id = aws_kms_key.backup_key.arn
}

# Data source for current AWS account
data "aws_caller_identity" "current" {
  provider = aws.primary
}

# Outputs
output "backup_bucket_primary" {
  value = aws_s3_bucket.backup_primary.id
}

output "backup_bucket_secondary" {
  value = aws_s3_bucket.backup_secondary.id
}

output "backup_vault_name" {
  value = aws_backup_vault.main.name
}

output "backup_kms_key_id" {
  value = aws_kms_key.backup_key.id
}

output "backup_role_arn" {
  value = aws_iam_role.backup_role.arn
}