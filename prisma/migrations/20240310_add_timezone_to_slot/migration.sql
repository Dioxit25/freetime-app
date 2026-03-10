-- Add timezone column to Slot table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Slot' AND column_name = 'timezone') THEN
        ALTER TABLE "Slot" ADD COLUMN "timezone" TEXT;
    END IF;
END $$;

-- Add index on timezone (if not exists)
CREATE INDEX IF NOT EXISTS "Slot_timezone_idx" ON "Slot"("timezone");
