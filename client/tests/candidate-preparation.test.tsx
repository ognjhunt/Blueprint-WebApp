import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CandidatePreparation } from "../src/components/shared/CandidatePreparation";
it("shows preparation for every candidate without invented scores or learned-policy claims", () => {
  render(<CandidatePreparation preview={{state: "available", revision: "opaque", catalogCandidateCount: 2, candidates: [
    {candidateId: "a", configurationDigest: "opaque-a", name: "Robot A policy", compatibility: "not_evaluated", kind: "learned_policy", notes: ["Access has not been verified."]},
    {candidateId: "b", configurationDigest: "opaque-b", name: "Robot B script", compatibility: "not_evaluated", kind: "scripted_baseline", notes: []},
  ]}} />);
  expect(screen.getAllByText("Not yet evaluated")).toHaveLength(2);
  expect(screen.getByText("Scripted simulation baseline")).toBeTruthy();
  expect(screen.getByText("Access has not been verified.")).toBeTruthy();
  expect(screen.queryByText(/scored outcomes|0\/0|success rate|ready to run/i)).toBeNull();
});
it("does not create a false empty result table on unavailable or fully superseded preview", () => {
  const {rerender} = render(<CandidatePreparation preview={{state: "unavailable", message: "Preparation details unavailable."}} />);
  expect(screen.getByRole("status")).toBeTruthy(); expect(screen.queryByRole("table")).toBeNull();
  rerender(<CandidatePreparation preview={{state: "available", revision: "opaque", catalogCandidateCount: 2, candidates: []}} />);
  expect(screen.queryByRole("table")).toBeNull();
});
