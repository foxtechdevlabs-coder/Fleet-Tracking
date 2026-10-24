// Settings types.
export type SettingScope = "global" | "per_vehicle";

export interface SettingInput {
  key: string;
  value: unknown;
  scope?: SettingScope;
  vehicleId?: string | null;
}

export interface SettingUpdateInput {
  value: unknown;
  scope?: SettingScope;
  vehicleId?: string | null;
}

export interface SettingDto {
  id: string;
  key: string;
  value: unknown;
  scope: SettingScope;
  vehicleId: string | null;
  updatedAt: Date;
}

export interface SettingsFilter {
  key?: string;
  vehicleId?: string | null;
  scope?: SettingScope;
}
