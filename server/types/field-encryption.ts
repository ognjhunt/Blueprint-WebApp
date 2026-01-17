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

export type EncryptableString = string | EncryptedField;
