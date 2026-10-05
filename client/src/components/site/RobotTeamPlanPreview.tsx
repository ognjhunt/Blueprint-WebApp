/** Entry into the free beta; legacy checkout and redirect callbacks are disabled. */
export function RobotTeamPlanPreview(_props: { sceneId?: string; onCheckout?: (url: string) => void } = {}) {
  return <p className="ms-field-hint">Evaluations are free when invited. <a href="/app">Open your workspace</a> to submit a robot and policy for review.</p>;
}
