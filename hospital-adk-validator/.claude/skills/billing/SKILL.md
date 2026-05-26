---
name: billing
description: Validate billing and insurance fields — detect missing insurance and negative billing amounts
trigger: When working with patient billing or insurance data validation
---

# Billing Validation Skill

## What This Skill Does
Validates financial and insurance fields in migration CSV data.

## Validation Rules

### Insurance Provider
- Must not be empty, null, or "None"
- Values checked: "", "nan", "None", "NaN", "none"
- Flag: "Missing insurance" if absent

### Billing Amount
- Must be a numeric value
- Must be >= 0
- Flag: "Negative billing amount" if below zero

## Output Format
```json
{
  "agent": "Billing Agent",
  "issues": ["Row N: Missing insurance for patient Name"],
  "issue_count": 1
}
```

## Implementation
See `core/agents.py` → `billing_agent()` function.
