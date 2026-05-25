-- CreateEnum
CREATE TYPE "case_source" AS ENUM ('BOB', 'EMMA', 'PR_TEAM');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "stages" (
    "id" SERIAL NOT NULL,
    "stageTitle" VARCHAR(100) NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "age" INTEGER,
    "incidentType" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "caseSummary" TEXT,
    "address911" TEXT,
    "callTime911" TEXT,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zip" TEXT,
    "arrestDate" TIMESTAMP(3),
    "stage_id" INTEGER,
    "dueDate" TIMESTAMP(3),
    "casePriority" TEXT,
    "caseSource" "case_source" NOT NULL,
    "priority" "priority" NOT NULL DEFAULT 'MEDIUM',

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserCases" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_UserCases_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserCases_B_index" ON "_UserCases"("B");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserCases" ADD CONSTRAINT "_UserCases_A_fkey" FOREIGN KEY ("A") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserCases" ADD CONSTRAINT "_UserCases_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
