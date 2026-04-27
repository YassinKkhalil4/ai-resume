ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_provider" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider_customer_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false;
--> statement-breakpoint
UPDATE "users" SET "is_admin" = false WHERE "is_admin" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "is_admin" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false;
--> statement-breakpoint
UPDATE "users" SET "email_verified" = false WHERE "email_verified" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
--> statement-breakpoint
ALTER TABLE IF EXISTS "credit_transactions" ALTER COLUMN "stripe_payment_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "payment_provider" text DEFAULT 'stripe';
--> statement-breakpoint
UPDATE "credit_transactions" SET "payment_provider" = 'stripe' WHERE "payment_provider" IS NULL;
--> statement-breakpoint
ALTER TABLE "credit_transactions" ALTER COLUMN "payment_provider" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "provider_order_id" text;
--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "provider_customer_id" text;
--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "provider_variant_id" text;
--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "provider_event_key" text;
--> statement-breakpoint
UPDATE "credit_transactions" SET "provider_order_id" = "stripe_payment_id" WHERE "provider_order_id" IS NULL AND "stripe_payment_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_provider_order_idx" ON "credit_transactions"("payment_provider", "provider_order_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"stripe_payment_id" text,
	"stripe_invoice_id" text,
	"payment_provider" text,
	"provider_order_id" text,
	"provider_customer_id" text,
	"provider_variant_id" text,
	"provider_event_key" text,
	"credits_total" integer NOT NULL,
	"credits_remaining" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "credit_lots" ADD COLUMN IF NOT EXISTS "payment_provider" text;
--> statement-breakpoint
ALTER TABLE "credit_lots" ADD COLUMN IF NOT EXISTS "provider_order_id" text;
--> statement-breakpoint
ALTER TABLE "credit_lots" ADD COLUMN IF NOT EXISTS "provider_customer_id" text;
--> statement-breakpoint
ALTER TABLE "credit_lots" ADD COLUMN IF NOT EXISTS "provider_variant_id" text;
--> statement-breakpoint
ALTER TABLE "credit_lots" ADD COLUMN IF NOT EXISTS "provider_event_key" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_lots_user_id_idx" ON "credit_lots"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_lots_expires_at_idx" ON "credit_lots"("expires_at");
--> statement-breakpoint
INSERT INTO "credit_lots" ("user_id", "source", "credits_total", "credits_remaining", "expires_at")
SELECT "id", 'backfill', "credits_remaining", "credits_remaining", now() + interval '12 months'
FROM "users" u
WHERE "credits_remaining" > 0
  AND NOT EXISTS (SELECT 1 FROM "credit_lots" cl WHERE cl."user_id" = u."id");
--> statement-breakpoint
UPDATE "users" u
SET "credits_remaining" = COALESCE((
  SELECT SUM(cl."credits_remaining")::integer
  FROM "credit_lots" cl
  WHERE cl."user_id" = u."id"
    AND cl."expires_at" > now()
    AND cl."credits_remaining" > 0
), 0);
--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'stripe';
--> statement-breakpoint
UPDATE "webhook_logs" SET "provider" = 'stripe' WHERE "provider" IS NULL;
--> statement-breakpoint
ALTER TABLE "webhook_logs" ALTER COLUMN "provider" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "event_id" text;
--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "provider_event_key" text;
--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "manual_review_reason" text;
--> statement-breakpoint
UPDATE "webhook_logs" SET "provider_event_key" = "id"::text WHERE "provider_event_key" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_logs_provider_event_idx" ON "webhook_logs"("provider", "provider_event_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"user_id" uuid,
	"session_id" text NOT NULL,
	"properties" jsonb,
	"context" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"device_type" text,
	"country" text,
	"referral_source" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"page_views" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_daily_rollups" (
	"date" date PRIMARY KEY NOT NULL,
	"dau" integer DEFAULT 0 NOT NULL,
	"wau" integer DEFAULT 0 NOT NULL,
	"mau" integer DEFAULT 0 NOT NULL,
	"total_tailoring_runs" integer DEFAULT 0 NOT NULL,
	"avg_ats_improvement" numeric(5, 4),
	"conversion_rate" numeric(5, 4),
	"revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "university_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_domain" text NOT NULL,
	"university_name" text,
	"user_count" integer DEFAULT 0 NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"credits_consumed" integer DEFAULT 0 NOT NULL,
	"conversion_to_paid" numeric(5, 4),
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "university_metrics_university_domain_unique" UNIQUE("university_domain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"user_id" uuid,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"code" text,
	"type" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tailoring_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text,
	"original_ats_score" numeric(5, 4),
	"tailored_ats_score" numeric(5, 4),
	"ats_delta" numeric(5, 4),
	"must_coverage_before" numeric(5, 4),
	"must_coverage_after" numeric(5, 4),
	"nice_coverage_before" numeric(5, 4),
	"nice_coverage_after" numeric(5, 4),
	"keywords_added" integer DEFAULT 0,
	"honesty_flags" integer DEFAULT 0,
	"polish_applied" boolean DEFAULT false,
	"time_to_complete" integer,
	"tokens_used" integer,
	"industry" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tailoring_runs" ADD CONSTRAINT "tailoring_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_event_name_idx" ON "analytics_events"("event_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_user_id_idx" ON "analytics_events"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_session_id_idx" ON "analytics_events"("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_email_idx" ON "contact_messages"("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_status_idx" ON "contact_messages"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_created_at_idx" ON "contact_messages"("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_tokens_code_idx" ON "email_verification_tokens"("code");
