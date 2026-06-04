import crypto from "crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import type {
  ContactInfo,
  RequestDetails,
  ContactInfoStored,
  RequestDetailsStored,
  PlaceLocationMetadata,
  PlaceLocationMetadataStored,
  DisplayCaptureMetadata,
  DisplayCaptureMetadataStored,
  RealSiteRobotEvalFitInput,
  RealSiteRobotEvalFitInputStored,
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
      dek: toBase64(Buffer.from(response.ciphertext as Uint8Array)),
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

function hasLocationMetadata(value?: PlaceLocationMetadata | null): value is PlaceLocationMetadata {
  if (!value) return false;
  return [
    value.placeId,
    value.formattedAddress,
    value.city,
    value.state,
    value.country,
    value.postalCode,
    value.lat,
    value.lng,
  ].some((entry) => entry !== null && entry !== undefined && entry !== "");
}

export async function encryptLocationMetadata(
  value?: PlaceLocationMetadata | null
): Promise<PlaceLocationMetadataStored | null> {
  if (!hasLocationMetadata(value)) {
    return null;
  }

  return {
    source: value.source ?? null,
    placeId: await encryptOptionalField(value.placeId ?? null),
    formattedAddress: await encryptOptionalField(value.formattedAddress ?? null),
    lat: typeof value.lat === "number" && Number.isFinite(value.lat) ? value.lat : null,
    lng: typeof value.lng === "number" && Number.isFinite(value.lng) ? value.lng : null,
    city: await encryptOptionalField(value.city ?? null),
    state: await encryptOptionalField(value.state ?? null),
    country: await encryptOptionalField(value.country ?? null),
    postalCode: await encryptOptionalField(value.postalCode ?? null),
  };
}

export async function decryptLocationMetadata(
  value?: PlaceLocationMetadataStored | null
): Promise<PlaceLocationMetadata | null> {
  if (!value) {
    return null;
  }

  return {
    source: value.source ?? null,
    placeId: await decryptOptionalField(value.placeId ?? null),
    formattedAddress: await decryptOptionalField(value.formattedAddress ?? null),
    lat: typeof value.lat === "number" && Number.isFinite(value.lat) ? value.lat : null,
    lng: typeof value.lng === "number" && Number.isFinite(value.lng) ? value.lng : null,
    city: await decryptOptionalField(value.city ?? null),
    state: await decryptOptionalField(value.state ?? null),
    country: await decryptOptionalField(value.country ?? null),
    postalCode: await decryptOptionalField(value.postalCode ?? null),
  };
}

function hasDisplayCaptureMetadata(value?: DisplayCaptureMetadata | null): value is DisplayCaptureMetadata {
  if (!value) return false;
  return [
    value.targetName,
    value.addressLabel,
    value.requestId,
    value.captureJobId,
    value.captureBrief,
    value.privacyReminder,
  ].some((entry) => entry !== null && entry !== undefined && entry !== "")
    || Boolean(value.allowedAdvisoryHints?.length);
}

export async function encryptDisplayCaptureMetadata(
  value?: DisplayCaptureMetadata | null
): Promise<DisplayCaptureMetadataStored | null> {
  if (!hasDisplayCaptureMetadata(value)) {
    return null;
  }

  return {
    targetName: await encryptOptionalField(value.targetName ?? null),
    addressLabel: await encryptOptionalField(value.addressLabel ?? null),
    requestId: value.requestId ?? null,
    captureJobId: value.captureJobId ?? null,
    captureBrief: await encryptOptionalField(value.captureBrief ?? null),
    privacyReminder: await encryptOptionalField(value.privacyReminder ?? null),
    allowedAdvisoryHints: value.allowedAdvisoryHints ?? [],
  };
}

export async function decryptDisplayCaptureMetadata(
  value?: DisplayCaptureMetadataStored | null
): Promise<DisplayCaptureMetadata | null> {
  if (!value) {
    return null;
  }

  return {
    targetName: await decryptOptionalField(value.targetName ?? null),
    addressLabel: await decryptOptionalField(value.addressLabel ?? null),
    requestId: value.requestId ?? null,
    captureJobId: value.captureJobId ?? null,
    captureBrief: await decryptOptionalField(value.captureBrief ?? null),
    privacyReminder: await decryptOptionalField(value.privacyReminder ?? null),
    allowedAdvisoryHints: value.allowedAdvisoryHints ?? [],
  };
}

function hasRobotEvalFit(value?: RealSiteRobotEvalFitInput | null): value is RealSiteRobotEvalFitInput {
  if (!value) return false;
  return [
    value.siteCardInput?.siteType,
    value.siteCardInput?.knownGeometryAssets,
    value.siteCardInput?.visualConditions,
    value.siteCardInput?.dynamicConditions,
    value.siteCardInput?.safetyConstraints,
    value.siteCardInput?.robotRelevantMetadata,
    value.taskCardInput?.task,
    value.taskCardInput?.startState,
    value.taskCardInput?.successDefinition,
    value.taskCardInput?.failureDefinition,
    value.taskCardInput?.requiredMetrics,
    value.scenarioCardInput?.normalScenario,
    value.scenarioCardInput?.variation,
    value.scenarioCardInput?.edgeCase,
    value.scenarioCardInput?.knownRisk,
    value.evalCardInput?.robotOrPolicyTested,
    value.evalCardInput?.preferredReviewPath,
    value.evalCardInput?.resultsValidationExpectations,
    value.evalCardInput?.predictedVsActualHistory,
  ].some((entry) => entry !== null && entry !== undefined && String(entry).trim() !== "");
}

export async function encryptRealSiteRobotEvalFit(
  value?: RealSiteRobotEvalFitInput | null
): Promise<RealSiteRobotEvalFitInputStored | null> {
  if (!hasRobotEvalFit(value)) {
    return null;
  }

  return {
    siteCardInput: {
      siteType: await encryptOptionalField(value.siteCardInput?.siteType ?? null),
      knownGeometryAssets: await encryptOptionalField(value.siteCardInput?.knownGeometryAssets ?? null),
      visualConditions: await encryptOptionalField(value.siteCardInput?.visualConditions ?? null),
      dynamicConditions: await encryptOptionalField(value.siteCardInput?.dynamicConditions ?? null),
      safetyConstraints: await encryptOptionalField(value.siteCardInput?.safetyConstraints ?? null),
      robotRelevantMetadata: await encryptOptionalField(value.siteCardInput?.robotRelevantMetadata ?? null),
    },
    taskCardInput: {
      task: await encryptOptionalField(value.taskCardInput?.task ?? null),
      startState: await encryptOptionalField(value.taskCardInput?.startState ?? null),
      successDefinition: await encryptOptionalField(value.taskCardInput?.successDefinition ?? null),
      failureDefinition: await encryptOptionalField(value.taskCardInput?.failureDefinition ?? null),
      requiredMetrics: await encryptOptionalField(value.taskCardInput?.requiredMetrics ?? null),
    },
    scenarioCardInput: {
      normalScenario: await encryptOptionalField(value.scenarioCardInput?.normalScenario ?? null),
      variation: await encryptOptionalField(value.scenarioCardInput?.variation ?? null),
      edgeCase: await encryptOptionalField(value.scenarioCardInput?.edgeCase ?? null),
      knownRisk: await encryptOptionalField(value.scenarioCardInput?.knownRisk ?? null),
    },
    evalCardInput: {
      robotOrPolicyTested: await encryptOptionalField(value.evalCardInput?.robotOrPolicyTested ?? null),
      preferredReviewPath: await encryptOptionalField(value.evalCardInput?.preferredReviewPath ?? null),
      resultsValidationExpectations: await encryptOptionalField(value.evalCardInput?.resultsValidationExpectations ?? null),
      predictedVsActualHistory: await encryptOptionalField(value.evalCardInput?.predictedVsActualHistory ?? null),
    },
  };
}

export async function decryptRealSiteRobotEvalFit(
  value?: RealSiteRobotEvalFitInputStored | null
): Promise<RealSiteRobotEvalFitInput | null> {
  if (!value) {
    return null;
  }

  const decrypted: RealSiteRobotEvalFitInput = {
    siteCardInput: {
      siteType: await decryptOptionalField(value.siteCardInput?.siteType ?? null),
      knownGeometryAssets: await decryptOptionalField(value.siteCardInput?.knownGeometryAssets ?? null),
      visualConditions: await decryptOptionalField(value.siteCardInput?.visualConditions ?? null),
      dynamicConditions: await decryptOptionalField(value.siteCardInput?.dynamicConditions ?? null),
      safetyConstraints: await decryptOptionalField(value.siteCardInput?.safetyConstraints ?? null),
      robotRelevantMetadata: await decryptOptionalField(value.siteCardInput?.robotRelevantMetadata ?? null),
    },
    taskCardInput: {
      task: await decryptOptionalField(value.taskCardInput?.task ?? null),
      startState: await decryptOptionalField(value.taskCardInput?.startState ?? null),
      successDefinition: await decryptOptionalField(value.taskCardInput?.successDefinition ?? null),
      failureDefinition: await decryptOptionalField(value.taskCardInput?.failureDefinition ?? null),
      requiredMetrics: await decryptOptionalField(value.taskCardInput?.requiredMetrics ?? null),
    },
    scenarioCardInput: {
      normalScenario: await decryptOptionalField(value.scenarioCardInput?.normalScenario ?? null),
      variation: await decryptOptionalField(value.scenarioCardInput?.variation ?? null),
      edgeCase: await decryptOptionalField(value.scenarioCardInput?.edgeCase ?? null),
      knownRisk: await decryptOptionalField(value.scenarioCardInput?.knownRisk ?? null),
    },
    evalCardInput: {
      robotOrPolicyTested: await decryptOptionalField(value.evalCardInput?.robotOrPolicyTested ?? null),
      preferredReviewPath: await decryptOptionalField(value.evalCardInput?.preferredReviewPath ?? null),
      resultsValidationExpectations: await decryptOptionalField(value.evalCardInput?.resultsValidationExpectations ?? null),
      predictedVsActualHistory: await decryptOptionalField(value.evalCardInput?.predictedVsActualHistory ?? null),
    },
  };

  return hasRobotEvalFit(decrypted) ? decrypted : null;
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
      requestedLanes: request.request.requestedLanes,
      helpWith: request.request.helpWith,
      details: await encryptOptionalField(request.request.details ?? null),
      buyerType: request.request.buyerType,
      commercialRequestPath: request.request.commercialRequestPath ?? null,
      siteName: await encryptFieldValue(
        request.request.siteName || request.contact.company || "Untitled site"
      ),
      siteLocation: await encryptFieldValue(
        request.request.siteLocation || "Location pending"
      ),
      siteLocationMetadata: await encryptLocationMetadata(
        request.request.siteLocationMetadata ?? null
      ),
      taskStatement: await encryptFieldValue(
        request.request.taskStatement || "Task statement pending"
      ),
      targetSiteType: await encryptOptionalField(
        request.request.targetSiteType ?? null
      ),
      proofPathPreference: request.request.proofPathPreference ?? null,
      existingStackReviewWorkflow: await encryptOptionalField(
        request.request.existingStackReviewWorkflow ?? null
      ),
      humanGateTopics: await encryptOptionalField(
        request.request.humanGateTopics ?? null
      ),
      workflowContext: await encryptOptionalField(
        request.request.workflowContext ?? null
      ),
      operatingConstraints: await encryptOptionalField(
        request.request.operatingConstraints ?? null
      ),
      privacySecurityConstraints: await encryptOptionalField(
        request.request.privacySecurityConstraints ?? null
      ),
      knownBlockers: await encryptOptionalField(
        request.request.knownBlockers ?? null
      ),
      targetRobotTeam: await encryptOptionalField(
        request.request.targetRobotTeam ?? null
      ),
      captureRights: await encryptOptionalField(
        request.request.captureRights ?? null
      ),
      derivedScenePermission: await encryptOptionalField(
        request.request.derivedScenePermission ?? null
      ),
      datasetLicensingPermission: await encryptOptionalField(
        request.request.datasetLicensingPermission ?? null
      ),
      payoutEligibility: await encryptOptionalField(
        request.request.payoutEligibility ?? null
      ),
      displayCaptureMetadata: await encryptDisplayCaptureMetadata(
        request.request.displayCaptureMetadata ?? null
      ),
      realSiteRobotEvalFit: await encryptRealSiteRobotEvalFit(
        request.request.realSiteRobotEvalFit ?? null
      ),
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
      requestedLanes: request.request.requestedLanes ?? [],
      helpWith: request.request.helpWith,
      details: await decryptOptionalField(request.request.details ?? null),
      buyerType: request.request.buyerType ?? "site_operator",
      commercialRequestPath: request.request.commercialRequestPath ?? null,
      siteName: request.request.siteName
        ? await decryptFieldValue(request.request.siteName)
        : request.contact.company
        ? await decryptFieldValue(request.contact.company)
        : "Legacy submission",
      siteLocation: request.request.siteLocation
        ? await decryptFieldValue(request.request.siteLocation)
        : "Legacy location",
      siteLocationMetadata: await decryptLocationMetadata(
        request.request.siteLocationMetadata ?? null
      ),
      taskStatement: request.request.taskStatement
        ? await decryptFieldValue(request.request.taskStatement)
        : "Legacy submission requires manual scoping",
      targetSiteType: await decryptOptionalField(
        request.request.targetSiteType ?? null
      ),
      proofPathPreference: request.request.proofPathPreference ?? null,
      existingStackReviewWorkflow: await decryptOptionalField(
        request.request.existingStackReviewWorkflow ?? null
      ),
      humanGateTopics: await decryptOptionalField(
        request.request.humanGateTopics ?? null
      ),
      workflowContext: await decryptOptionalField(
        request.request.workflowContext ?? null
      ),
      operatingConstraints: await decryptOptionalField(
        request.request.operatingConstraints ?? null
      ),
      privacySecurityConstraints: await decryptOptionalField(
        request.request.privacySecurityConstraints ?? null
      ),
      knownBlockers: await decryptOptionalField(
        request.request.knownBlockers ?? null
      ),
      targetRobotTeam: await decryptOptionalField(
        request.request.targetRobotTeam ?? null
      ),
      captureRights: await decryptOptionalField(
        request.request.captureRights ?? null
      ),
      derivedScenePermission: await decryptOptionalField(
        request.request.derivedScenePermission ?? null
      ),
      datasetLicensingPermission: await decryptOptionalField(
        request.request.datasetLicensingPermission ?? null
      ),
      payoutEligibility: await decryptOptionalField(
        request.request.payoutEligibility ?? null
      ),
      displayCaptureMetadata: await decryptDisplayCaptureMetadata(
        request.request.displayCaptureMetadata ?? null
      ),
      realSiteRobotEvalFit: await decryptRealSiteRobotEvalFit(
        request.request.realSiteRobotEvalFit ?? null
      ),
    },
  };
}
