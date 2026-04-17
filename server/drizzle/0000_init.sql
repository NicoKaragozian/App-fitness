CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"garmin_id" text,
	"sport_type" text NOT NULL,
	"category" text NOT NULL,
	"start_time" text NOT NULL,
	"duration" integer,
	"distance" double precision,
	"calories" integer,
	"avg_hr" integer,
	"max_speed" double precision,
	"raw_json" text,
	CONSTRAINT "activities_garmin_id_unique" UNIQUE("garmin_id")
);
--> statement-breakpoint
CREATE TABLE "daily_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"steps" integer,
	"calories" integer,
	"body_battery" integer,
	"resting_hr" integer,
	"raw_json" text,
	CONSTRAINT "daily_summary_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "hrv" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"nightly_avg" double precision,
	"status" text,
	"raw_json" text,
	CONSTRAINT "hrv_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "sleep" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"score" integer,
	"duration_seconds" integer,
	"deep_seconds" integer,
	"light_seconds" integer,
	"rem_seconds" integer,
	"awake_seconds" integer,
	"raw_json" text,
	CONSTRAINT "sleep_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "stress" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"avg_stress" integer,
	"max_stress" integer,
	"raw_json" text,
	CONSTRAINT "stress_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_type" text NOT NULL,
	"started_at" text NOT NULL,
	"completed_at" text,
	"status" text DEFAULT 'running'
);
--> statement-breakpoint
CREATE TABLE "ai_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"content" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "sport_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#6a9cff' NOT NULL,
	"icon" text DEFAULT '◎' NOT NULL,
	"sport_types" jsonb NOT NULL,
	"metrics" jsonb NOT NULL,
	"chart_metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "weekly_plan" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" text NOT NULL,
	"sport" text NOT NULL,
	"detail" text,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" text,
	"plan_id" integer,
	"session_id" integer
);
--> statement-breakpoint
CREATE TABLE "training_exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'main' NOT NULL,
	"target_sets" integer,
	"target_reps" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"description" text,
	"type" text DEFAULT 'strength',
	"target_duration_seconds" integer,
	"target_distance_meters" double precision,
	"target_pace" text
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"objective" text,
	"frequency" text,
	"status" text DEFAULT 'active' NOT NULL,
	"ai_model" text,
	"raw_ai_response" text,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"type" text
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"started_at" text NOT NULL,
	"completed_at" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"workout_log_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer,
	"weight" double precision,
	"completed" boolean DEFAULT false,
	"notes" text,
	"duration_seconds" double precision,
	"distance_meters" double precision
);
--> statement-breakpoint
CREATE TABLE "nutrition_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"logged_at" text,
	"meal_slot" text,
	"meal_name" text,
	"description" text,
	"calories" integer,
	"protein_g" integer,
	"carbs_g" integer,
	"fat_g" integer,
	"fiber_g" integer,
	"image_path" text,
	"ai_model" text,
	"ai_confidence" text,
	"raw_ai_response" text
);
--> statement-breakpoint
CREATE TABLE "nutrition_plan_meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"slot" text,
	"name" text,
	"description" text,
	"calories" integer,
	"protein_g" integer,
	"carbs_g" integer,
	"fat_g" integer,
	"option_number" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "nutrition_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"training_plan_id" integer,
	"title" text,
	"daily_calories" integer,
	"daily_protein_g" integer,
	"daily_carbs_g" integer,
	"daily_fat_g" integer,
	"strategy" text,
	"rationale" text,
	"ai_model" text,
	"raw_ai_response" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "goal_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"week_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target" text,
	"workouts" jsonb DEFAULT '[]'::jsonb,
	"completed" boolean DEFAULT false,
	"completed_at" text,
	"sort_order" integer DEFAULT 0,
	"duration" text,
	"tips" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_date" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"prerequisites" jsonb DEFAULT '[]'::jsonb,
	"common_mistakes" jsonb DEFAULT '[]'::jsonb,
	"estimated_timeline" text,
	"ai_model" text,
	"raw_ai_response" text,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "user_assessment" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text,
	"age" integer,
	"height" double precision,
	"weight" double precision,
	"fitness_level" text,
	"goals" jsonb,
	"goals_other" text,
	"sport_practice" text,
	"sport_name" text,
	"available_days" jsonb,
	"session_duration" integer,
	"equipment" jsonb,
	"equipment_other" text,
	"injuries_limitations" text,
	"training_preferences" text,
	"past_injuries_detail" text,
	"time_constraints" text,
	"short_term_goals" text,
	"long_term_goals" text,
	"special_considerations" text,
	"updated_at" text,
	CONSTRAINT "user_assessment_single_row" CHECK ("user_assessment"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" integer PRIMARY KEY NOT NULL,
	"has_wearable" boolean DEFAULT false,
	"name" text,
	"age" integer,
	"sex" text,
	"height_cm" integer,
	"weight_kg" double precision,
	"experience_level" text,
	"primary_goal" text,
	"secondary_goals" jsonb,
	"sports" jsonb,
	"training_days_per_week" integer,
	"session_duration_min" integer,
	"equipment" jsonb,
	"injuries" text,
	"dietary_preferences" jsonb,
	"daily_calorie_target" integer,
	"daily_protein_g" integer,
	"daily_carbs_g" integer,
	"daily_fat_g" integer,
	"onboarded_at" text,
	"updated_at" text,
	CONSTRAINT "user_profile_single_row" CHECK ("user_profile"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "training_exercises" ADD CONSTRAINT "training_exercises_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_id_training_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."training_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_plan_meals" ADD CONSTRAINT "nutrition_plan_meals_plan_id_nutrition_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."nutrition_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_training_plan_id_training_plans_id_fk" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activities_start_time" ON "activities" USING btree ("start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_summary_date" ON "daily_summary" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hrv_date" ON "hrv" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sleep_date" ON "sleep" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stress_date" ON "stress" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_ai_cache_mode_created" ON "ai_cache" USING btree ("mode","created_at");--> statement-breakpoint
CREATE INDEX "idx_training_plans_status" ON "training_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workout_logs_plan_id" ON "workout_logs" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_workout_logs_session_id" ON "workout_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_workout_sets_log_id" ON "workout_sets" USING btree ("workout_log_id");--> statement-breakpoint
CREATE INDEX "idx_workout_sets_exercise_id" ON "workout_sets" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "idx_nutrition_logs_date" ON "nutrition_logs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_goals_status" ON "goals" USING btree ("status");