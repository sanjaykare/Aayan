---
name: demographics
description: Validate patient demographic fields — age range, gender values, and blood type format
trigger: When working with patient demographic data validation
---

# Demographics Validation Skill

## What This Skill Does
Validates patient demographic fields in migration CSV data.

## Validation Rules

### Age
- Must be a numeric value
- Valid range: 0 to 120 (inclusive)
- Flag: "Invalid age" if outside range or non-numeric

### Gender
- Valid values: Male, Female, Other
- Case-sensitive match
- Flag: "Invalid gender" if not in valid set

### Blood Type
- Valid values: A+, A-, B+, B-, AB+, AB-, O+, O-
- Flag: "Invalid blood type" if not in valid set

## Output Format
```json
{
  "agent": "Demographic Agent",
  "issues": ["Row N: Invalid age (X) for patient Name"],
  "issue_count": 2
}
```

## Implementation
See `core/agents.py` → `demographic_agent()` function.
