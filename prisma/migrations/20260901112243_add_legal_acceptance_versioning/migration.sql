-- CreateTable
CREATE TABLE "legal_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_acceptances_userId_userType_idx" ON "legal_acceptances"("userId", "userType");
