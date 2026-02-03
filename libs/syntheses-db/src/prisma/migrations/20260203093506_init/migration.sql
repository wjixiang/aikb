-- CreateEnum
CREATE TYPE "review_type_enum" AS ENUM ('SYSTEMATIC_REVIEW', 'META_ANALYSIS', 'SYSTEMATIC_REVIEW_WITH_META_ANALYSIS', 'OVERVIEW_OF_REVIEWS', 'SCOPING_REVIEW', 'RAPID_REVIEW', 'NETWORK_META_ANALYSIS', 'LIVING_SYSTEMATIC_REVIEW');

-- CreateEnum
CREATE TYPE "publication_status_enum" AS ENUM ('PUBLISHED', 'PREPRINT', 'IN_PROGRESS', 'WITHDRAWN', 'PROTOCOL');

-- CreateEnum
CREATE TYPE "evidence_quality_enum" AS ENUM ('HIGH', 'MODERATE', 'LOW', 'VERY_LOW', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "author_role_enum" AS ENUM ('PRIMARY', 'CORRESPONDING', 'CO_AUTHOR', 'REVIEWER');

-- CreateEnum
CREATE TYPE "database_source_enum" AS ENUM ('PUBMED', 'COCHRANE', 'EMBASE', 'WEB_OF_SCIENCE', 'SCOPUS', 'PSYCINFO', 'CINAHL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "sync_status_enum" AS ENUM ('SYNCED', 'SYNCING', 'FAILED', 'PARTIAL', 'PENDING', 'STALE');

-- CreateEnum
CREATE TYPE "quality_rating_enum" AS ENUM ('HIGH', 'MODERATE', 'LOW', 'CRITICALLY_LOW');

-- CreateEnum
CREATE TYPE "url_type_enum" AS ENUM ('FULL_TEXT', 'ABSTRACT', 'DATABASE_ENTRY', 'SUPPLEMENTARY', 'PROTOCOL', 'PREPRINT', 'PUBLISHER');

-- CreateEnum
CREATE TYPE "access_level_enum" AS ENUM ('OPEN', 'SUBSCRIPTION', 'PAY_PER_VIEW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "review_relationship_enum" AS ENUM ('UPDATE', 'PREVIOUS_VERSION', 'DUPLICATE', 'SIMILAR_TOPIC', 'COMPANION', 'CORRECTION', 'WITHDRAWN_BY');

-- CreateEnum
CREATE TYPE "sync_job_status_enum" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "checkpoint_status_enum" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "position_type_enum" AS ENUM ('OFFSET', 'PAGE', 'CURSOR_ID', 'TIMESTAMP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "export_format_enum" AS ENUM ('JSON', 'CSV', 'EXCEL', 'XML', 'BIBTEX', 'RIS');

-- CreateTable
CREATE TABLE "review_index" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(1000) NOT NULL,
    "alternative_titles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "review_type" "review_type_enum" NOT NULL,
    "publication_status" "publication_status_enum" NOT NULL,
    "doi" VARCHAR(255),
    "pmid" VARCHAR(50),
    "cochrane_id" VARCHAR(100),
    "publication_date" TIMESTAMPTZ(6),
    "last_updated_date" TIMESTAMPTZ(6),
    "abstract" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mesh_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "research_questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conclusions" TEXT,
    "included_studies_count" INTEGER,
    "total_participants_count" INTEGER,
    "evidence_quality" "evidence_quality_enum",
    "funding" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conflicts_of_interest" TEXT,
    "custom_metadata" JSONB,
    "content_hash" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_author" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "initials" VARCHAR(50),
    "affiliation" TEXT,
    "orcid" VARCHAR(100),
    "role" "author_role_enum" NOT NULL,
    "position" INTEGER,

    CONSTRAINT "review_author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_database_id" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "source" "database_source_enum" NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "version" VARCHAR(100),

    CONSTRAINT "review_database_id_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_journal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "abbreviation" VARCHAR(255),
    "issn" VARCHAR(50),
    "eissn" VARCHAR(50),
    "publisher" VARCHAR(500),
    "volume" VARCHAR(50),
    "issue" VARCHAR(50),
    "pages" VARCHAR(100),
    "article_number" VARCHAR(100),

    CONSTRAINT "review_journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_eligibility_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "inclusion_criteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclusion_criteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "study_designs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "population" TEXT,
    "intervention" TEXT,
    "comparison" TEXT,
    "outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "review_eligibility_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_pico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "population" TEXT,
    "intervention" TEXT,
    "comparison" TEXT,
    "outcome" TEXT,
    "study_design" TEXT,
    "timeframe" TEXT,

    CONSTRAINT "review_pico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_sync_metadata" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "first_synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "sync_status_enum" NOT NULL,
    "synced_databases" "database_source_enum"[],
    "sync_version" INTEGER NOT NULL DEFAULT 1,
    "primary_source" "database_source_enum" NOT NULL,

    CONSTRAINT "review_sync_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_failed_sync" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sync_metadata_id" UUID NOT NULL,
    "database" "database_source_enum" NOT NULL,
    "error" TEXT NOT NULL,
    "failed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retry_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "review_failed_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_quality_assessment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "tool" VARCHAR(100),
    "overall_score" INTEGER,
    "max_score" INTEGER,
    "rating" "quality_rating_enum",
    "assessed_at" TIMESTAMPTZ(6),
    "comments" TEXT,

    CONSTRAINT "review_quality_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_domain_score" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "comments" TEXT,

    CONSTRAINT "review_domain_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_url" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "type" "url_type_enum" NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "description" TEXT,
    "access" "access_level_enum" NOT NULL,

    CONSTRAINT "review_url_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_related_review" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "related_id" UUID NOT NULL,
    "relationship" "review_relationship_enum" NOT NULL,
    "description" TEXT,

    CONSTRAINT "review_related_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "version" VARCHAR(100) NOT NULL,
    "review_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_reason" TEXT,
    "changed_by" VARCHAR(255),

    CONSTRAINT "review_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_job" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "database" "database_source_enum" NOT NULL,
    "status" "sync_job_status_enum" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "new_records" INTEGER NOT NULL DEFAULT 0,
    "updated_records" INTEGER NOT NULL DEFAULT 0,
    "failed_records" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "estimated_time_remaining" INTEGER,

    CONSTRAINT "sync_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCheckpoint" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "database" "database_source_enum" NOT NULL,
    "job_id" UUID NOT NULL,
    "status" "checkpoint_status_enum" NOT NULL,
    "position_type" "position_type_enum" NOT NULL,
    "position_offset" INTEGER,
    "position_last_source_id" VARCHAR(255),
    "position_last_timestamp" TIMESTAMPTZ(6),
    "position_page" INTEGER,
    "position_custom_data" JSONB,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "sync_options" JSONB,
    "metrics_records_per_second" DOUBLE PRECISION,
    "metrics_avg_processing_time" INTEGER,
    "metrics_estimated_time_remaining" INTEGER,
    "quality_failed_transformations" INTEGER,
    "quality_duplicates_detected" INTEGER,
    "quality_quality_issues" INTEGER,
    "sync_jobId" UUID,

    CONSTRAINT "SyncCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_sync_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" "database_source_enum" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "endpoint" VARCHAR(500),
    "api_key" VARCHAR(255),
    "sync_schedule" VARCHAR(100),
    "batch_size" INTEGER NOT NULL DEFAULT 100,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "rate_limit" INTEGER,
    "query_params" JSONB,
    "field_mappings" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_sync_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sync_version" INTEGER NOT NULL DEFAULT 1,
    "enable_deduplication" BOOLEAN NOT NULL DEFAULT true,
    "deduplication_threshold" DOUBLE PRECISION,
    "enable_quality_assessment" BOOLEAN NOT NULL DEFAULT true,
    "default_quality_tool" VARCHAR(100),
    "retention_max_versions" INTEGER,
    "retention_max_age_days" INTEGER,
    "retention_archive_old" BOOLEAN NOT NULL DEFAULT false,
    "notification_email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notification_email_recipients" TEXT[],
    "notification_email_events" TEXT[],
    "notification_webhook_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notification_webhook_url" VARCHAR(500),
    "notification_webhook_events" TEXT[],
    "notification_webhook_secret" VARCHAR(255),
    "checkpoint_enabled" BOOLEAN NOT NULL DEFAULT false,
    "checkpoint_interval" INTEGER,
    "checkpoint_max_checkpoints" INTEGER,
    "checkpoint_auto_resume" BOOLEAN NOT NULL DEFAULT false,
    "checkpoint_retention_max_age_days" INTEGER,
    "checkpoint_retention_keep_latest_only" BOOLEAN NOT NULL DEFAULT false,
    "checkpoint_retention_keep_completed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_config_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "config_data" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(255),

    CONSTRAINT "sync_config_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_job" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "format" "export_format_enum" NOT NULL,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "file_size" BIGINT NOT NULL DEFAULT 0,
    "download_url" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "options" JSONB,

    CONSTRAINT "export_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_review_pair" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review1_id" UUID NOT NULL,
    "review2_id" UUID NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_review_pair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_index_doi_key" ON "review_index"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "review_index_pmid_key" ON "review_index"("pmid");

-- CreateIndex
CREATE UNIQUE INDEX "review_index_cochrane_id_key" ON "review_index"("cochrane_id");

-- CreateIndex
CREATE INDEX "review_index_review_type_idx" ON "review_index"("review_type");

-- CreateIndex
CREATE INDEX "review_index_publication_status_idx" ON "review_index"("publication_status");

-- CreateIndex
CREATE INDEX "review_index_evidence_quality_idx" ON "review_index"("evidence_quality");

-- CreateIndex
CREATE INDEX "review_index_publication_date_idx" ON "review_index"("publication_date");

-- CreateIndex
CREATE INDEX "review_index_created_at_idx" ON "review_index"("created_at");

-- CreateIndex
CREATE INDEX "review_index_content_hash_idx" ON "review_index"("content_hash");

-- CreateIndex
CREATE INDEX "review_author_review_id_idx" ON "review_author"("review_id");

-- CreateIndex
CREATE INDEX "review_database_id_review_id_idx" ON "review_database_id"("review_id");

-- CreateIndex
CREATE INDEX "review_database_id_source_idx" ON "review_database_id"("source");

-- CreateIndex
CREATE UNIQUE INDEX "review_database_id_source_source_id_key" ON "review_database_id"("source", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_journal_review_id_key" ON "review_journal"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_eligibility_criteria_review_id_key" ON "review_eligibility_criteria"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_pico_review_id_key" ON "review_pico"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_sync_metadata_review_id_key" ON "review_sync_metadata"("review_id");

-- CreateIndex
CREATE INDEX "review_sync_metadata_status_idx" ON "review_sync_metadata"("status");

-- CreateIndex
CREATE INDEX "review_sync_metadata_primary_source_idx" ON "review_sync_metadata"("primary_source");

-- CreateIndex
CREATE INDEX "review_failed_sync_sync_metadata_id_idx" ON "review_failed_sync"("sync_metadata_id");

-- CreateIndex
CREATE INDEX "review_failed_sync_database_idx" ON "review_failed_sync"("database");

-- CreateIndex
CREATE UNIQUE INDEX "review_quality_assessment_review_id_key" ON "review_quality_assessment"("review_id");

-- CreateIndex
CREATE INDEX "review_domain_score_assessment_id_idx" ON "review_domain_score"("assessment_id");

-- CreateIndex
CREATE INDEX "review_url_review_id_idx" ON "review_url"("review_id");

-- CreateIndex
CREATE INDEX "review_related_review_review_id_idx" ON "review_related_review"("review_id");

-- CreateIndex
CREATE INDEX "review_related_review_related_id_idx" ON "review_related_review"("related_id");

-- CreateIndex
CREATE INDEX "review_related_review_relationship_idx" ON "review_related_review"("relationship");

-- CreateIndex
CREATE UNIQUE INDEX "review_related_review_review_id_related_id_key" ON "review_related_review"("review_id", "related_id");

-- CreateIndex
CREATE INDEX "review_version_review_id_idx" ON "review_version"("review_id");

-- CreateIndex
CREATE INDEX "review_version_created_at_idx" ON "review_version"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_version_review_id_version_key" ON "review_version"("review_id", "version");

-- CreateIndex
CREATE INDEX "sync_job_database_idx" ON "sync_job"("database");

-- CreateIndex
CREATE INDEX "sync_job_status_idx" ON "sync_job"("status");

-- CreateIndex
CREATE INDEX "sync_job_created_at_idx" ON "sync_job"("created_at");

-- CreateIndex
CREATE INDEX "SyncCheckpoint_database_idx" ON "SyncCheckpoint"("database");

-- CreateIndex
CREATE INDEX "SyncCheckpoint_job_id_idx" ON "SyncCheckpoint"("job_id");

-- CreateIndex
CREATE INDEX "SyncCheckpoint_status_idx" ON "SyncCheckpoint"("status");

-- CreateIndex
CREATE INDEX "SyncCheckpoint_created_at_idx" ON "SyncCheckpoint"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "database_sync_config_source_key" ON "database_sync_config"("source");

-- CreateIndex
CREATE INDEX "database_sync_config_enabled_idx" ON "database_sync_config"("enabled");

-- CreateIndex
CREATE INDEX "sync_config_version_config_id_idx" ON "sync_config_version"("config_id");

-- CreateIndex
CREATE INDEX "sync_config_version_updated_at_idx" ON "sync_config_version"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_config_version_config_id_version_key" ON "sync_config_version"("config_id", "version");

-- CreateIndex
CREATE INDEX "export_job_created_at_idx" ON "export_job"("created_at");

-- CreateIndex
CREATE INDEX "export_job_expires_at_idx" ON "export_job"("expires_at");

-- CreateIndex
CREATE INDEX "duplicate_review_pair_similarity_idx" ON "duplicate_review_pair"("similarity");

-- CreateIndex
CREATE INDEX "duplicate_review_pair_created_at_idx" ON "duplicate_review_pair"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "duplicate_review_pair_review1_id_review2_id_key" ON "duplicate_review_pair"("review1_id", "review2_id");

-- AddForeignKey
ALTER TABLE "review_author" ADD CONSTRAINT "review_author_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_database_id" ADD CONSTRAINT "review_database_id_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_journal" ADD CONSTRAINT "review_journal_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_eligibility_criteria" ADD CONSTRAINT "review_eligibility_criteria_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_pico" ADD CONSTRAINT "review_pico_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_sync_metadata" ADD CONSTRAINT "review_sync_metadata_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_failed_sync" ADD CONSTRAINT "review_failed_sync_sync_metadata_id_fkey" FOREIGN KEY ("sync_metadata_id") REFERENCES "review_sync_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_quality_assessment" ADD CONSTRAINT "review_quality_assessment_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_domain_score" ADD CONSTRAINT "review_domain_score_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "review_quality_assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_url" ADD CONSTRAINT "review_url_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_related_review" ADD CONSTRAINT "review_related_review_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_related_review" ADD CONSTRAINT "review_related_review_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_version" ADD CONSTRAINT "review_version_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "review_index"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCheckpoint" ADD CONSTRAINT "SyncCheckpoint_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "sync_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCheckpoint" ADD CONSTRAINT "SyncCheckpoint_sync_jobId_fkey" FOREIGN KEY ("sync_jobId") REFERENCES "sync_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_config_version" ADD CONSTRAINT "sync_config_version_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "sync_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
