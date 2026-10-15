/**
 * A complete, valid supply agreement for fixtures.
 *
 * Synthetic references only. A test team that should be recommendable needs
 * this on its registry row: `status: "engaged"` alone no longer makes a team
 * supply (see `server/utils/robotTeamSupply.ts`).
 */
import {
  SUPPLY_AGREEMENT_SCHEMA_VERSION,
  type RobotTeamSupplyAgreement,
  type SupplyAgreementEntry,
} from "../../types/robot-team-registry";
import { SUPPORTED_SUPPLY_INTERFACE_ID } from "../../utils/robotTeamSupply";

export function syntheticAgreementEntry(overrides: Partial<SupplyAgreementEntry> = {}): SupplyAgreementEntry {
  return {
    agreedOn: "2026-10-10",
    evidenceRef: "signed-note:synthetic-fixture",
    recordedBy: "synthetic-reviewer",
    recordedAt: "2026-10-11T00:00:00.000Z",
    ...overrides,
  };
}

export function completeSupplyAgreement(): RobotTeamSupplyAgreement {
  return {
    schemaVersion: SUPPLY_AGREEMENT_SCHEMA_VERSION,
    terms: {
      supportedInterface: syntheticAgreementEntry({ interfaceId: SUPPORTED_SUPPLY_INTERFACE_ID }),
      freeEvaluation: syntheticAgreementEntry(),
      pilotIfPassed: syntheticAgreementEntry(),
    },
    history: [],
  };
}
