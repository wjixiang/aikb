-- CreateTable
CREATE TABLE "quizzes" (
    "_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(10) NOT NULL,
    "class" VARCHAR(255) NOT NULL,
    "unit" VARCHAR(255) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "question" TEXT,
    "main_question" TEXT,
    "options" JSONB,
    "answer" JSONB,
    "analysis" JSONB,
    "source" VARCHAR(255),
    "specific_data" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("_id")
);
