CREATE TABLE IF NOT EXISTS "tailor_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" text DEFAULT 'success',
	"model_used" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"latency_ms" integer,
	"credits_used" integer,
	"feature_flags" jsonb,
	"final_ats_before" integer,
	"final_ats_after" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tailor_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"stage" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tailor_debug_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"snapshot_type" text NOT NULL,
	"content" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tailor_runs" ADD CONSTRAINT "tailor_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tailor_run_events" ADD CONSTRAINT "tailor_run_events_run_id_tailor_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "tailor_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tailor_debug_snapshots" ADD CONSTRAINT "tailor_debug_snapshots_run_id_tailor_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "tailor_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_runs_user_id_idx" ON "tailor_runs"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_runs_session_id_idx" ON "tailor_runs"("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_runs_status_idx" ON "tailor_runs"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_runs_created_at_idx" ON "tailor_runs"("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_run_events_run_id_idx" ON "tailor_run_events"("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_run_events_timestamp_idx" ON "tailor_run_events"("timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_run_events_stage_idx" ON "tailor_run_events"("stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_run_events_run_id_timestamp_idx" ON "tailor_run_events"("run_id","timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_debug_snapshots_run_id_idx" ON "tailor_debug_snapshots"("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tailor_debug_snapshots_expires_at_idx" ON "tailor_debug_snapshots"("expires_at");

