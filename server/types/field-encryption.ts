export type EncryptionAlgorithm = "aes-256-gcm";
export type DekAlgorithm = "kms" | "aes-256-gcm";

export interface EncryptedField {
  ciphertext: string;
  iv: string;
  authTag: string;
  dek: string;
  dekIv?: string;
  dekAuthTag?: string;
  keyVersion: string;
  alg: EncryptionAlgorithm;
  dekAlg: DekAlgorithm;
}

export interface BoundEncryptedField extends EncryptedField {
  bindingVersion: "blueprint-bound-field.v1";
  associatedDataSha256: string;
}

export type EncryptableString = string | EncryptedField;
