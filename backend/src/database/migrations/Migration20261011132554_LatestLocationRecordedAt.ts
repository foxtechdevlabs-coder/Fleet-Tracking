import { Migration } from '@mikro-orm/migrations';

export class Migration20261011132554_LatestLocationRecordedAt extends Migration {
  override name = 'Migration20261011132554_LatestLocationRecordedAt';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "latest_locations" add "recorded_at" timestamptz;`,
    );
    this.addSql(`
      with newest_valid_history as (
        select distinct on ("vehicle_id")
          "vehicle_id", "recorded_at", "latitude", "longitude", "speed", "heading"
        from "location_history"
        where "latitude" between -90 and 90
          and "longitude" between -180 and 180
        order by "vehicle_id", "recorded_at" desc, "ingested_at" desc, "id" desc
      )
      update "latest_locations" as latest
      set "latitude" = history."latitude",
          "longitude" = history."longitude",
          "speed" = history."speed",
          "heading" = history."heading",
          "recorded_at" = history."recorded_at"
      from newest_valid_history as history
      where latest."vehicle_id" = history."vehicle_id";
    `);
    this.addSql(`
      update "latest_locations"
      set "recorded_at" = "updated_at"
      where "recorded_at" is null;
    `);
    this.addSql(
      `alter table "latest_locations" alter column "recorded_at" set not null;`,
    );
    this.addSql(
      `comment on column "latest_locations"."recorded_at" is 'Timestamp of the location currently stored for this vehicle';`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "latest_locations" drop column "recorded_at";`);
  }
}
