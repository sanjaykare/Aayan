# Hospital Migration Validator — Agent Rules

## Project Purpose
This is an ADK demo project that automates hospital migration validation
during KareXpert onboarding. It converts manual CSV validation work into
an AI-agent workflow.

## Architecture
- Framework: FastAPI + Pandas
- No database, no authentication
- Agents are deterministic Python functions (workflow automation, not prediction AI)
- Migration hook decides BLOCK/PASS based on issue count threshold

## Agent System
Four specialised agents:
1. **Demographic Agent** — validates age, gender, blood type
2. **Billing Agent** — checks for missing insurance, negative bills
3. **Timeline Agent** — checks discharge-before-admission, future admissions
4. **Statistics Agent** — computes summary metrics (informational only)

## Hook System
- Migration Hook runs after all agents
- Sums issue_count from validation agents (not statistics)
- If total_issues > 3 → BLOCK migration
- Otherwise → PASS migration

## File Structure
- `app.py` — FastAPI application entry point
- `core/loader.py` — CSV loading and normalisation
- `core/agents.py` — All four agent functions
- `core/hooks.py` — Migration hook logic
- `core/validator.py` — Orchestrator that runs agents + hook

## Rules
- Keep the implementation simple and self-contained
- Do not add database or authentication layers
- All validation logic must be deterministic (no LLM calls)
- CSV fields: Name, Age, Gender, Blood Type, Medical Condition,
  Date of Admission, Doctor, Insurance Provider, Billing Amount, Discharge Date
