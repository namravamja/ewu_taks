-- AlterTable
ALTER TABLE "Case" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "idx_case_subject_name_trgm" ON "Case" USING GIN ("subjectName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_case_incident_type_trgm" ON "Case" USING GIN ("incidentType" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_case_summary_trgm" ON "Case" USING GIN ("caseSummary" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_case_address_911_trgm" ON "Case" USING GIN ("address911" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_case_state_trgm" ON "Case" USING GIN ("state" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_case_city_trgm" ON "Case" USING GIN ("city" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_case_zip_trgm" ON "Case" USING GIN ("zip" gin_trgm_ops);
