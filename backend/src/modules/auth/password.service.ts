// Password service — cryptographic password hashing and verification.
import {
  hashPassword,
  verifyPassword,
} from "../../common/utils/password.util.js";

export const PasswordService = {
  hashPassword,
  verifyPassword,
};

export { hashPassword, verifyPassword };
