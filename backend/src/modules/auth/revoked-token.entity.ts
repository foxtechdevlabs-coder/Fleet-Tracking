// RevokedToken entity — persists logout revocation for bearer access tokens.
import { EntitySchema } from "@mikro-orm/core";

export class RevokedToken {
  id!: string;
  expiresAt!: Date;
  revokedAt!: Date;
}

export const RevokedTokenSchema = new EntitySchema<RevokedToken>({
  class: RevokedToken,
  tableName: "revoked_tokens",
  properties: {
    id: {
      type: "uuid",
      primary: true,
      fieldName: "token_id",
    },
    expiresAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "expires_at",
    },
    revokedAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "revoked_at",
      onCreate: () => new Date(),
    },
  },
});
