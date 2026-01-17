import crypto from "crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import type {
  ContactInfo,
  RequestDetails,
  ContactInfoStored,
  RequestDetailsStored,
} from "../types/inbound-request";
import type { EncryptedField, EncryptableString } from "../types/field-encryption";

const MASTER_KEY_ENV = "FIELD_ENCRYPTION_MASTER_KEY";
const KMS_KEY_ENV = "FIELD_ENCRYPTION_KMS_KEY_NAME";

const AES_256_GCM_ALG = "aes-256-gcm";
const DATA_KEY_BYTES = 32;
const IV_BYTES = 12;

let kmsClient: KeyManagementServiceClient | null = null;

function getKmsClient(): KeyManagementServiceClient {
  if (!kmsClient) {
    kmsClient = new KeyManagementServiceClient();
  }
  return kmsClient;
}

function getLocalMasterKey(): Buffer {
  const rawKey = process.env[MASTER_KEY_ENV];
  if (!rawKey) {
    throw new Error(
      "FIELD_ENCRYPTION_MASTER_KEY is required when KMS is not configured."
    );
  }

  const key = Buffer.from(rawKey, "base64");
  if (key.length !== DATA_KEY_BYTES) {
    throw new Error("FIELD_ENCRYPTION_MASTER_KEY must be 32 bytes base64.");
  }
  return key;
}

export function isEncryptedField(value: unknown): value is EncryptedField {
  if (!value || typeof value !== "object") return false;
  const field = value as EncryptedField;
  return (
    typeof field.ciphertext === "string" &&
    typeof field.iv === "string" &&
    typeof field.authTag === "string" &&
    typeof field.dek === "string" &&
    typeof field.keyVersion === "string" &&
    field.alg === AES_256_GCM_ALG &&
    (field.dekAlg === "kms" || field.dekAlg === "aes-256-gcm")
  );
}

function toBase64(data: Buffer | Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function fromBase64(value: string): Buffer {
  return Buffer.from(value, "base64");
}

async function wrapDataKey(dataKey: Buffer): Promise<{
  dek: string;
  dekIv?: string;
  dekAuthTag?: string;
  keyVersion: string;
  dekAlg: "kms" | "aes-256-gcm";
}> {
  const kmsKeyName = process.env[KMS_KEY_ENV];
  if (kmsKeyName) {
    const [response] = await getKmsClient().encrypt({
      name: kmsKeyName,
      plaintext: dataKey,
    });

    if (!response.ciphertext) {
      throw new Error("KMS encryption failed: missing ciphertext");
    }

    return {
      dek: toBase64(response.ciphertext),
      keyVersion: response.name || kmsKeyName,
      dekAlg: "kms",
    };
  }

  const masterKey = getLocalMasterKey();
  const dekIv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(AES_256_GCM_ALG, masterKey, dekIv);
  const encryptedDek = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const dekAuthTag = cipher.getAuthTag();

  return {
    dek: encryptedDek.toString("base64"),
    dekIv: dekIv.toString("base64"),
    dekAuthTag: dekAuthTag.toString("base64"),
    keyVersion: "local",
    dekAlg: "aes-256-gcm",
  };
}

async function unwrapDataKey(encrypted: EncryptedField): Promise<Buffer> {
  if (encrypted.dekAlg === "kms") {
    const kmsKeyName = process.env[KMS_KEY_ENV];
    if (!kmsKeyName) {
      throw new Error("KMS key name is required for KMS decryption.");
    }
    const [response] = await getKmsClient().decrypt({
      name: kmsKeyName,
      ciphertext: fromBase64(encrypted.dek),
    });

    if (!response.plaintext) {
      throw new Error("KMS decryption failed: missing plaintext");
    }

    return Buffer.from(response.plaintext as Uint8Array);
  }

  const masterKey = getLocalMasterKey();
  if (!encrypted.dekIv || !encrypted.dekAuthTag) {
    throw new Error("Local key decryption failed: missing dek metadata.");
  }

  const decipher = crypto.createDecipheriv(
    AES_256_GCM_ALG,
    masterKey,
    fromBase64(encrypted.dekIv)
  );
  decipher.setAuthTag(fromBase64(encrypted.dekAuthTag));
  return Buffer.concat([
    decipher.update(fromBase64(encrypted.dek)),
    decipher.final(),
  ]);
}

export async function encryptFieldValue(value: string): Promise<EncryptedField> {
  const dataKey = crypto.randomBytes(DATA_KEY_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(AES_256_GCM_ALG, dataKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const wrapped = await wrapDataKey(dataKey);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    dek: wrapped.dek,
    dekIv: wrapped.dekIv,
    dekAuthTag: wrapped.dekAuthTag,
    keyVersion: wrapped.keyVersion,
    alg: AES_256_GCM_ALG,
    dekAlg: wrapped.dekAlg,
  };
}

export async function decryptFieldValue(
  value: EncryptableString
): Promise<string> {
  if (!isEncryptedField(value)) {
    return value;
  }

  const dataKey = await unwrapDataKey(value);
  const decipher = crypto.createDecipheriv(
    AES_256_GCM_ALG,
    dataKey,
    fromBase64(value.iv)
  );
  decipher.setAuthTag(fromBase64(value.authTag));
  const plaintext = Buffer.concat([
    decipher.update(fromBase64(value.ciphertext)),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export async function encryptOptionalField(
  value?: string | null
): Promise<EncryptableString | null | undefined> {
  if (value === null || value === undefined) {
    return value;
  }
  return encryptFieldValue(value);
}

export async function decryptOptionalField(
  value?: EncryptableString | null
): Promise<string | null | undefined> {
  if (value === null || value === undefined) {
    return value;
  }
  return decryptFieldValue(value);
}

export async function encryptInboundRequestForStorage<
  T extends {
    contact: ContactInfo;
    request: RequestDetails;
  },
>(request: T): Promise<Omit<T, "contact" | "request"> & {
  contact: ContactInfoStored;
  request: RequestDetailsStored;
}> {
  return {
    ...request,
    contact: {
      firstName: await encryptFieldValue(request.contact.firstName),
      lastName: await encryptFieldValue(request.contact.lastName),
      email: await encryptFieldValue(request.contact.email),
      roleTitle: await encryptFieldValue(request.contact.roleTitle),
      company: await encryptFieldValue(request.contact.company),
    },
    request: {
      budgetBucket: request.request.budgetBucket,
      helpWith: request.request.helpWith,
      details: await encryptOptionalField(request.request.details ?? null),
    },
  };
}

export async function decryptInboundRequestForAdmin<
  T extends {
    contact: ContactInfoStored;
    request: RequestDetailsStored;
  },
>(request: T): Promise<Omit<T, "contact" | "request"> & {
  contact: ContactInfo;
  request: RequestDetails;
}> {
  return {
    ...request,
    contact: {
      firstName: await decryptFieldValue(request.contact.firstName),
      lastName: await decryptFieldValue(request.contact.lastName),
      email: await decryptFieldValue(request.contact.email),
      roleTitle: await decryptFieldValue(request.contact.roleTitle),
      company: await decryptFieldValue(request.contact.company),
    },
    request: {
      budgetBucket: request.request.budgetBucket,
      helpWith: request.request.helpWith,
      details: await decryptOptionalField(request.request.details ?? null),
    },
  };
}
