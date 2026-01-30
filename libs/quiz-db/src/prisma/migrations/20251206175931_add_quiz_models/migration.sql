-- CreateTable
CREATE TABLE "quizzes" (
    "_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mongo_id_legacy" TEXT NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "class" VARCHAR(255) NOT NULL,
    "unit" VARCHAR(255) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" VARCHAR(255),
    "year" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quiz_a1_a2" (
    "quiz_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" VARCHAR(5) NOT NULL,

    CONSTRAINT "quiz_a1_a2_pkey" PRIMARY KEY ("quiz_id")
);

-- CreateTable
CREATE TABLE "quiz_a3" (
    "quiz_id" UUID NOT NULL,
    "main_question" TEXT NOT NULL,
    "sub_quizzes" JSONB NOT NULL,

    CONSTRAINT "quiz_a3_pkey" PRIMARY KEY ("quiz_id")
);

-- CreateTable
CREATE TABLE "quiz_b" (
    "quiz_id" UUID NOT NULL,
    "options" JSONB NOT NULL,
    "questions" JSONB NOT NULL,

    CONSTRAINT "quiz_b_pkey" PRIMARY KEY ("quiz_id")
);

-- CreateTable
CREATE TABLE "quiz_x" (
    "quiz_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answers" TEXT[],

    CONSTRAINT "quiz_x_pkey" PRIMARY KEY ("quiz_id")
);

-- CreateTable
CREATE TABLE "quiz_analysis" (
    "_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quiz_id" UUID NOT NULL,
    "reference" TEXT,
    "discuss" TEXT,
    "ai_analysis" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_analysis_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quiz_analysis_quiz_id_key" ON "quiz_analysis"("quiz_id");

-- AddForeignKey
ALTER TABLE "quiz_a1_a2" ADD CONSTRAINT "quiz_a1_a2_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_a3" ADD CONSTRAINT "quiz_a3_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_b" ADD CONSTRAINT "quiz_b_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_x" ADD CONSTRAINT "quiz_x_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_analysis" ADD CONSTRAINT "quiz_analysis_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
