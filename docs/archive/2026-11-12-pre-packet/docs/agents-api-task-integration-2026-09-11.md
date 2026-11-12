# Durable Task Evaluation operator integration

This work unblocks ADP-009D's day-28 development rehearsal and the reusable
ADP-080 delivery path. The completion artifact is a Pipeline-owned task result
with an authenticated Website readback. A model response does not establish
policy success, billing settlement, resource release or customer notification.

The existing generic chat runtimes cannot own a managed Task Evaluation job:
they assume a local invocation completes a run. The added provider adapter
instead reads the durable Pipeline owner. Firestore retains the product run,
pending actions and observation history; the provider session never becomes
the product's primary key.

Pipeline publishes only a typed admission reference to
`POST /api/internal/pipeline/agent-execution/admissions`, using the existing
`PIPELINE_SYNC_TOKEN` HMAC and exact request body. A replay is idempotent. The
same task cannot acquire another source, model, digest or expiry through a
replacement admission. Revocation may disable it.

The dedicated worker consumes `agentExecutionPending`. It records action
intent before selecting the same Pipeline task, and recovers transport losses
by inspecting that identity. A committed cancellation takes precedence over a
later enqueue decision. A cancellation request remains pending until Pipeline
reports a terminal outcome. Cleanup preserves the original result and its
completion time.

The operator panel under the existing agent console uses
`/api/admin/agent/adp/tasks`. It retains the enclosing Firebase and CSRF
middleware and additionally requires verified execution access. Browser
requests contain only the admitted task id and a supported action. Prompts,
paths, credentials and authority cannot be supplied through this surface.

Required worker configuration:

- `BLUEPRINT_AGENT_PIPELINE_BASE_URL`: the HTTPS Pipeline origin followed by
  `/api/live-pipeline`.
- `CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN`: the existing server-side intake secret.
- `PIPELINE_SYNC_TOKEN`: the existing inbound Pipeline signing secret.

The `built-in-adp-run-operator` profile describes this controller. Admitted
`openai_agents_api` and `openai_agents_sdk` executions retain their actual
runtime identity. Generic chat execution refuses both runtime identities;
they use the task panel and the durable worker.

The result projection strips unknown producer fields, validates the declared
output and its digest, and checks task/run/release/model identity. The complete
producer receipt remains in Pipeline; its digest is retained as an opaque
reference because numeric JSON serialization differs between Python and JS.

Focused checks cover signed admission, actor scope, rejected caller arguments,
lost replies, competing workers, cancellation races, terminal immutability and
cleanup retention. A focused browser fixture verifies pending cancellation, terminal updates and
cleanup without losing the diagnosis. Live production verification remains
required before claiming the end-to-end integration is complete.
# Adaptive interpretation and selected Paperclip worker

Episode tasks retain the original Python result digest and add an RFC 8785
digest for their numeric output across the Website boundary. The operator
shows a timeline and missing evidence. A completed model answer remains pending
until the Pipeline worker's independent collection succeeds or refuses it;
interpretation never changes the task score.

The `blueprint-adp-execution` Paperclip tool accepts only an action. It resolves
the current heartbeat run and assigned issue from Paperclip, then selects the
task in `issue.metadata.blueprintAdpExecution`:

```json
{"program":"arm-decision-proof-v1","taskId":"server-admitted-task-id"}
```

Configure the same `BLUEPRINT_PAPERCLIP_ADP_AGENT_ID`,
`BLUEPRINT_PAPERCLIP_ADP_COMPANY_ID`, and private
`BLUEPRINT_PAPERCLIP_ADP_BRIDGE_TOKEN` on the trusted plugin host and WebApp.
The plugin additionally uses `BLUEPRINT_PAPERCLIP_ADP_WEBAPP_URL` (HTTPS origin).
These settings select one ADP worker; they do not change the other employee
runtimes. The bridge persists one task owner and the heartbeat-run linkage in
Firestore, and the plugin retains request/observation state in Paperclip.
Repeated requests select the same durable task. Neither a model answer nor a
successful tool call closes the Paperclip issue or proves product completion.

This integration is inactive until those server settings and an issue binding
are admitted. Its code/tests do not establish a live Paperclip execution.
