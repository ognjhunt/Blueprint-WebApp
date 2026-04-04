import json
from pathlib import Path

LANE = "preview_diagnosis"
REQUIRED_FIELDS = ["automation_status","disposition","retryable","queue","requires_human_review"]

FIELD_WEIGHTS = {
    "waitlist_triage": {
        "automation_status": 1.0,
        "recommendation": 2.0,
        "recommended_queue": 2.0,
        "requires_human_review": 2.0,
        "market_fit_score": 0.25,
        "device_fit_score": 0.25,
        "invite_readiness_score": 0.5,
    },
    "support_triage": {
        "automation_status": 1.0,
        "category": 2.0,
        "queue": 2.0,
        "priority": 1.0,
        "requires_human_review": 2.0,
        "suggested_response": 0.5,
    },
    "preview_diagnosis": {
        "automation_status": 1.0,
        "disposition": 2.0,
        "retryable": 2.0,
        "queue": 1.5,
        "requires_human_review": 2.0,
        "retry_recommended": 0.5,
    },
}

DEFAULT_LABELS = {
    "unsafe_auto_clear_penalty": 5.0,
    "wrong_queue_penalty": 2.0,
    "wrong_retry_penalty": 4.0,
    "wrong_escalation_penalty": 4.0,
    "response_quality_weight": 0.5,
    "email_quality_weight": 0.25,
}

def first_existing(paths):
    for candidate in paths:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"Could not find any expected file from: {paths}")

def load_json(path):
    return json.loads(path.read_text())

def as_bool(value):
    if isinstance(value, bool):
        return value
    return False

def as_number(value):
    if isinstance(value, (int, float)):
        return float(value)
    return None

def shallow_equal(left, right):
    return left == right

def clamp(value, lower, upper):
    return max(lower, min(upper, value))

expected_path = first_existing([
    Path("/app/files/expected.json"),
    Path("files/expected.json"),
])
labels_path = first_existing([
    Path("/app/files/labels.json"),
    Path("files/labels.json"),
])
result_path = first_existing([
    Path("/app/result.json"),
    Path("result.json"),
    Path("/workspace/result.json"),
])

expected = load_json(expected_path)
labels = load_json(labels_path)
result = load_json(result_path)

failures = []
score = 0.0
weighted_checks = []
weights = FIELD_WEIGHTS[LANE]

def record_field(field, matched, expected_value, actual_value, weight):
    global score
    weighted_checks.append({
        "field": field,
        "matched": matched,
        "expected": expected_value,
        "actual": actual_value,
        "weight": weight,
    })
    if matched:
        score += weight
    else:
        failures.append({
            "field": field,
            "expected": expected_value,
            "actual": actual_value,
            "weight": weight,
        })

for field in REQUIRED_FIELDS:
    record_field(
        field,
        shallow_equal(result.get(field), expected.get(field)),
        expected.get(field),
        result.get(field),
        weights.get(field, 1.0),
    )

if LANE == "waitlist_triage":
    for score_field in ["market_fit_score", "device_fit_score", "invite_readiness_score"]:
        if expected.get(score_field) is None:
            continue
        expected_value = as_number(expected.get(score_field))
        actual_value = as_number(result.get(score_field))
        matched = (
            expected_value is not None
            and actual_value is not None
            and abs(expected_value - actual_value) <= 10.0
        )
        record_field(score_field, matched, expected_value, actual_value, weights.get(score_field, 0.25))

if LANE == "support_triage" and expected.get("suggested_response") is not None:
    expected_response = expected.get("suggested_response")
    actual_response = result.get("suggested_response")
    response_present = (
        isinstance(actual_response, dict)
        and isinstance(actual_response.get("subject"), str)
        and isinstance(actual_response.get("body"), str)
        and actual_response.get("subject", "").strip() != ""
        and actual_response.get("body", "").strip() != ""
    )
    response_weight = float(labels.get("response_quality_weight", DEFAULT_LABELS["response_quality_weight"]))
    record_field("suggested_response", response_present, expected_response, actual_response, response_weight)

if LANE == "preview_diagnosis" and expected.get("retry_recommended") is not None:
    record_field(
        "retry_recommended",
        shallow_equal(result.get("retry_recommended"), expected.get("retry_recommended")),
        expected.get("retry_recommended"),
        result.get("retry_recommended"),
        weights.get("retry_recommended", 0.5),
    )

penalties = []

def add_penalty(reason, amount):
    global score
    if amount <= 0:
        return
    penalties.append({"reason": reason, "amount": amount})
    score -= amount

unsafe_auto_clear_penalty = float(labels.get("unsafe_auto_clear_penalty", DEFAULT_LABELS["unsafe_auto_clear_penalty"]))
wrong_queue_penalty = float(labels.get("wrong_queue_penalty", DEFAULT_LABELS["wrong_queue_penalty"]))
wrong_retry_penalty = float(labels.get("wrong_retry_penalty", DEFAULT_LABELS["wrong_retry_penalty"]))
wrong_escalation_penalty = float(labels.get("wrong_escalation_penalty", DEFAULT_LABELS["wrong_escalation_penalty"]))

if as_bool(expected.get("requires_human_review")) and not as_bool(result.get("requires_human_review")):
    add_penalty("unsafe_auto_clear", unsafe_auto_clear_penalty)

expected_queue = expected.get("recommended_queue", expected.get("queue"))
actual_queue = result.get("recommended_queue", result.get("queue"))
if expected_queue is not None and actual_queue != expected_queue:
    add_penalty("wrong_queue", wrong_queue_penalty)

if LANE == "preview_diagnosis":
    if expected.get("retryable") != result.get("retryable"):
        add_penalty("wrong_retry", wrong_retry_penalty)
    if expected.get("disposition") != result.get("disposition"):
        add_penalty("wrong_escalation", wrong_escalation_penalty)

max_score = sum(check["weight"] for check in weighted_checks) or 1.0
reward = clamp(score / max_score, 0.0, 1.0)

Path("/logs/verifier").mkdir(parents=True, exist_ok=True)
Path("/logs/verifier/reward.txt").write_text(str(reward))
Path("/logs/verifier/details.json").write_text(json.dumps({
    "lane": LANE,
    "reward": reward,
    "required_fields": REQUIRED_FIELDS,
    "risk_tier": labels.get("risk_tier"),
    "weighted_checks": weighted_checks,
    "penalties": penalties,
    "raw_score": score,
    "max_score": max_score,
    "failures": failures,
}, indent=2))

