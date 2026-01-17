import type { DecodedIdToken } from "firebase-admin/auth";

declare module "express-serve-static-core" {
  interface Locals {
    firebaseUser?: DecodedIdToken;
  }
}
