# Multi-Region Disaster Recovery Infrastructure for n8n-MCP

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "n8n-mcp-terraform-state"
    key    = "disaster-recovery/terraform.tfstate"
    region = "us-east-1"
    encrypt = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Configure providers for each region
provider "aws" {
  alias  = "primary"
  region = var.primary_region
}

provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}

provider "aws" {
  alias  = "tertiary"
  region = var.tertiary_region
}

# Variables
variable "primary_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region for failover"
  type        = string
  default     = "eu-west-1"
}

variable "tertiary_region" {
  description = "Tertiary AWS region for additional redundancy"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "n8n-mcp"
}

# Data sources
data "aws_availability_zones" "primary" {
  provider = aws.primary
  state    = "available"
}

data "aws_availability_zones" "secondary" {
  provider = aws.secondary
  state    = "available"
}

data "aws_availability_zones" "tertiary" {
  provider = aws.tertiary
  state    = "available"
}

# Primary Region Infrastructure
module "primary_region" {
  source = "../modules/region-infrastructure"
  providers = {
    aws = aws.primary
  }
  
  region            = var.primary_region
  environment       = var.environment
  project_name      = var.project_name
  vpc_cidr          = "10.0.0.0/16"
  availability_zones = data.aws_availability_zones.primary.names
  
  is_primary_region = true
  replica_regions   = [var.secondary_region, var.tertiary_region]
  
  database_config = {
    instance_class         = "db.r6g.2xlarge"
    allocated_storage      = 500
    max_allocated_storage  = 1000
    backup_retention_period = 30
    enable_global_cluster  = true
  }
  
  tags = {
    DR-Role     = "primary"
    DR-Priority = "1"
  }
}

# Secondary Region Infrastructure
module "secondary_region" {
  source = "../modules/region-infrastructure"
  providers = {
    aws = aws.secondary
  }
  
  region            = var.secondary_region
  environment       = "${var.environment}-dr"
  project_name      = var.project_name
  vpc_cidr          = "10.1.0.0/16"
  availability_zones = data.aws_availability_zones.secondary.names
  
  is_primary_region = false
  primary_region    = var.primary_region
  
  database_config = {
    instance_class         = "db.r6g.xlarge" # Smaller for cost optimization
    allocated_storage      = 500
    max_allocated_storage  = 1000
    backup_retention_period = 7
    is_read_replica        = true
    source_region          = var.primary_region
  }
  
  tags = {
    DR-Role     = "secondary"
    DR-Priority = "2"
  }
}

# Tertiary Region Infrastructure (minimal standby)
module "tertiary_region" {
  source = "../modules/region-infrastructure"
  providers = {
    aws = aws.tertiary
  }
  
  region            = var.tertiary_region
  environment       = "${var.environment}-dr2"
  project_name      = var.project_name
  vpc_cidr          = "10.2.0.0/16"
  availability_zones = [data.aws_availability_zones.tertiary.names[0]] # Single AZ for cost
  
  is_primary_region = false
  primary_region    = var.primary_region
  minimal_setup     = true # Reduced resources
  
  database_config = {
    instance_class         = "db.t4g.large" # Minimal instance
    allocated_storage      = 100
    max_allocated_storage  = 500
    backup_retention_period = 3
    is_read_replica        = true
    source_region          = var.secondary_region # Chain from secondary
  }
  
  tags = {
    DR-Role     = "tertiary"
    DR-Priority = "3"
  }
}

# Cross-region VPC peering
resource "aws_vpc_peering_connection" "primary_to_secondary" {
  provider = aws.primary
  
  vpc_id      = module.primary_region.vpc_id
  peer_vpc_id = module.secondary_region.vpc_id
  peer_region = var.secondary_region
  
  tags = {
    Name = "${var.project_name}-primary-secondary-peering"
  }
}

resource "aws_vpc_peering_connection_accepter" "secondary" {
  provider = aws.secondary
  
  vpc_peering_connection_id = aws_vpc_peering_connection.primary_to_secondary.id
  auto_accept               = true
  
  tags = {
    Name = "${var.project_name}-primary-secondary-peering"
  }
}

resource "aws_vpc_peering_connection" "primary_to_tertiary" {
  provider = aws.primary
  
  vpc_id      = module.primary_region.vpc_id
  peer_vpc_id = module.tertiary_region.vpc_id
  peer_region = var.tertiary_region
  
  tags = {
    Name = "${var.project_name}-primary-tertiary-peering"
  }
}

resource "aws_vpc_peering_connection_accepter" "tertiary" {
  provider = aws.tertiary
  
  vpc_peering_connection_id = aws_vpc_peering_connection.primary_to_tertiary.id
  auto_accept               = true
  
  tags = {
    Name = "${var.project_name}-primary-tertiary-peering"
  }
}

# Global Aurora Database Cluster
resource "aws_rds_global_cluster" "main" {
  provider = aws.primary
  
  global_cluster_identifier = "${var.project_name}-global"
  engine                    = "aurora-postgresql"
  engine_version           = "15.2"
  database_name            = "n8n_mcp"
  storage_encrypted        = true
  
  lifecycle {
    prevent_destroy = true
  }
}

# Route53 Health Checks
resource "aws_route53_health_check" "primary" {
  fqdn              = module.primary_region.alb_dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  
  tags = {
    Name   = "${var.project_name}-primary-health"
    Region = var.primary_region
  }
}

resource "aws_route53_health_check" "secondary" {
  fqdn              = module.secondary_region.alb_dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  
  tags = {
    Name   = "${var.project_name}-secondary-health"
    Region = var.secondary_region
  }
}

resource "aws_route53_health_check" "tertiary" {
  count = module.tertiary_region.minimal_setup ? 0 : 1
  
  fqdn              = module.tertiary_region.alb_dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  
  tags = {
    Name   = "${var.project_name}-tertiary-health"
    Region = var.tertiary_region
  }
}

# Route53 Failover Records
resource "aws_route53_record" "primary" {
  zone_id = var.hosted_zone_id
  name    = "api.${var.domain_name}"
  type    = "A"
  
  set_identifier = "primary"
  
  failover_routing_policy {
    type = "PRIMARY"
  }
  
  alias {
    name                   = module.primary_region.alb_dns_name
    zone_id                = module.primary_region.alb_zone_id
    evaluate_target_health = true
  }
  
  health_check_id = aws_route53_health_check.primary.id
}

resource "aws_route53_record" "secondary" {
  zone_id = var.hosted_zone_id
  name    = "api.${var.domain_name}"
  type    = "A"
  
  set_identifier = "secondary"
  
  failover_routing_policy {
    type = "SECONDARY"
  }
  
  alias {
    name                   = module.secondary_region.alb_dns_name
    zone_id                = module.secondary_region.alb_zone_id
    evaluate_target_health = true
  }
  
  health_check_id = aws_route53_health_check.secondary.id
}

# Weighted routing for gradual failover
resource "aws_route53_record" "weighted_primary" {
  zone_id = var.hosted_zone_id
  name    = "api-weighted.${var.domain_name}"
  type    = "A"
  
  set_identifier = "weighted-primary"
  
  weighted_routing_policy {
    weight = var.primary_weight
  }
  
  alias {
    name                   = module.primary_region.alb_dns_name
    zone_id                = module.primary_region.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "weighted_secondary" {
  zone_id = var.hosted_zone_id
  name    = "api-weighted.${var.domain_name}"
  type    = "A"
  
  set_identifier = "weighted-secondary"
  
  weighted_routing_policy {
    weight = var.secondary_weight
  }
  
  alias {
    name                   = module.secondary_region.alb_dns_name
    zone_id                = module.secondary_region.alb_zone_id
    evaluate_target_health = true
  }
}

# Geolocation routing
resource "aws_route53_record" "geo_us" {
  zone_id = var.hosted_zone_id
  name    = "api-geo.${var.domain_name}"
  type    = "A"
  
  set_identifier = "geo-us"
  
  geolocation_routing_policy {
    continent = "NA"
  }
  
  alias {
    name                   = module.primary_region.alb_dns_name
    zone_id                = module.primary_region.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "geo_eu" {
  zone_id = var.hosted_zone_id
  name    = "api-geo.${var.domain_name}"
  type    = "A"
  
  set_identifier = "geo-eu"
  
  geolocation_routing_policy {
    continent = "EU"
  }
  
  alias {
    name                   = module.secondary_region.alb_dns_name
    zone_id                = module.secondary_region.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "geo_asia" {
  zone_id = var.hosted_zone_id
  name    = "api-geo.${var.domain_name}"
  type    = "A"
  
  set_identifier = "geo-asia"
  
  geolocation_routing_policy {
    continent = "AS"
  }
  
  alias {
    name                   = module.tertiary_region.alb_dns_name
    zone_id                = module.tertiary_region.alb_zone_id
    evaluate_target_health = true
  }
}

# Default geolocation record
resource "aws_route53_record" "geo_default" {
  zone_id = var.hosted_zone_id
  name    = "api-geo.${var.domain_name}"
  type    = "A"
  
  set_identifier = "geo-default"
  
  geolocation_routing_policy {
    country = "*"
  }
  
  alias {
    name                   = module.primary_region.alb_dns_name
    zone_id                = module.primary_region.alb_zone_id
    evaluate_target_health = true
  }
}

# Outputs
output "primary_region_endpoint" {
  value = module.primary_region.api_endpoint
}

output "secondary_region_endpoint" {
  value = module.secondary_region.api_endpoint
}

output "tertiary_region_endpoint" {
  value = module.tertiary_region.api_endpoint
}

output "global_database_endpoint" {
  value = aws_rds_global_cluster.main.engine == "aurora-postgresql" ? "${aws_rds_global_cluster.main.global_cluster_identifier}.cluster-${aws_rds_global_cluster.main.id}.${var.primary_region}.rds.amazonaws.com" : ""
  sensitive = true
}

output "health_check_ids" {
  value = {
    primary   = aws_route53_health_check.primary.id
    secondary = aws_route53_health_check.secondary.id
    tertiary  = try(aws_route53_health_check.tertiary[0].id, null)
  }
}