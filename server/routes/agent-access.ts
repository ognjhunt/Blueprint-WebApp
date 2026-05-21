import { Router } from "express";
import { buildRobotAgentOpenApiContract } from "../utils/robot-agent-contract";

const router = Router();

router.get("/openapi.json", (_req, res) => {
  res.status(200).json(buildRobotAgentOpenApiContract());
});

router.get("/", (_req, res) => {
  res.status(200).json({
    name: "Blueprint Robot-Team Agent Access",
    docs: "/agents",
    openapi: "/api/agent-access/openapi.json",
    staticOpenapi: "/agent-access.openapi.json",
    llms: "/llms.txt",
    llmsFull: "/llms-full.txt",
    publicDemoSiteWorldId: "siteworld-f5fd54898cfb",
    env: {
      apiBaseUrl: "BLUEPRINT_API_BASE_URL",
      bearerToken: "BLUEPRINT_AGENT_AUTH_TOKEN",
    },
    truth:
      "Public demo endpoints are sample/demo only. Protected site worlds require Firebase robot-team/admin bearer auth and current launch readiness.",
  });
});

export default router;
