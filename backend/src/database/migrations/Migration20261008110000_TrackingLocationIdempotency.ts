// Enforce one stored location per registered device timestamp for idempotent ingestion.
import { Migration } from "@mikro-orm/migrations";

export class Migration20261008110000_TrackingLocationIdempotency extends Migration {
  override up(): void {
    this.addSql(
      'create unique index if not exists "uq_location_history_device_recorded_at" on "location_history" ("device_id", "recorded_at");',
    );
  }

  override down(): void {
    this.addSql(
      'drop index if exists "uq_location_history_device_recorded_at";',
    );
  }
}
