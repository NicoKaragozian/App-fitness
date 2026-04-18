CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garmin_tokens" (
	"user_id" text PRIMARY KEY NOT NULL,
	"oauth1_ciphertext" text NOT NULL,
	"oauth1_iv" text NOT NULL,
	"oauth1_tag" text NOT NULL,
	"oauth2_ciphertext" text NOT NULL,
	"oauth2_iv" text NOT NULL,
	"oauth2_tag" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_garmin_id_unique";--> statement-breakpoint
ALTER TABLE "daily_summary" DROP CONSTRAINT "daily_summary_date_unique";--> statement-breakpoint
ALTER TABLE "hrv" DROP CONSTRAINT "hrv_date_unique";--> statement-breakpoint
ALTER TABLE "sleep" DROP CONSTRAINT "sleep_date_unique";--> statement-breakpoint
ALTER TABLE "stress" DROP CONSTRAINT "stress_date_unique";--> statement-breakpoint
ALTER TABLE "user_assessment" DROP CONSTRAINT "user_assessment_single_row";--> statement-breakpoint
ALTER TABLE "user_profile" DROP CONSTRAINT "user_profile_single_row";--> statement-breakpoint
DROP INDEX "idx_daily_summary_date";--> statement-breakpoint
DROP INDEX "idx_hrv_date";--> statement-breakpoint
DROP INDEX "idx_sleep_date";--> statement-breakpoint
DROP INDEX "idx_stress_date";--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'ai_cache'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "ai_cache" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'sport_groups'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "sport_groups" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "daily_summary" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "hrv" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "sleep" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "stress" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "sync_log" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "ai_cache" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "sport_groups" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "weekly_plan" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "training_exercises" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "training_plans" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "nutrition_logs" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "nutrition_plan_meals" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "nutrition_plans" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "goal_milestones" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "user_assessment" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garmin_tokens" ADD CONSTRAINT "garmin_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activities_user_id" ON "activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daily_summary_user_date" ON "daily_summary" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_hrv_user_date" ON "hrv" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_sleep_user_date" ON "sleep" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_stress_user_date" ON "stress" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_ai_cache_user_key" ON "ai_cache" USING btree ("user_id","cache_key");--> statement-breakpoint
CREATE INDEX "idx_sport_groups_user_id" ON "sport_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_training_plans_user_id" ON "training_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_workout_logs_user_id" ON "workout_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_nutrition_logs_user_id" ON "nutrition_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_nutrition_plans_user_id" ON "nutrition_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_goals_user_id" ON "goals" USING btree ("user_id");