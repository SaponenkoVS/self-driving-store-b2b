import { Migration } from "@mikro-orm/migrations";

export class Migration20261105120000 extends Migration {
  async up(): Promise<void> {
    this.addSql('ALTER TABLE IF EXISTS "company" ADD COLUMN IF NOT EXISTS "tax_id" text NULL;');
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_company_tax_id" ON "company" (tax_id) WHERE deleted_at IS NULL;'
    );
  }

  async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS "IDX_company_tax_id";');
    this.addSql('ALTER TABLE IF EXISTS "company" DROP COLUMN IF EXISTS "tax_id";');
  }
}
