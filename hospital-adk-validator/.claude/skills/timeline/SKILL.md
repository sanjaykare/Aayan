---
name: timeline
description: Validate admission and discharge date consistency — detect date ordering errors and future dates
trigger: When working with patient admission or discharge date validation
---

# Timeline Validation Skill

## What This Skill Does
Validates date consistency in migration CSV data.

## Validation Rules

### Discharge Before Admission
- Discharge Date must be on or after Date of Admission
- Flag: "Discharge before admission" if discharge < admission

### Future Admission
- Date of Admission must not be in the future (compared to current date)
- Flag: "Future admission date" if admission > today

### Missing Dates
- Both Date of Admission and Discharge Date must be present and parseable
- Flag: "Missing date values" or "Unparseable dates" if invalid

## Output Format
```json
{
  "agent": "Timeline Agent",
  "issues": ["Row N: Discharge (YYYY-MM-DD) before admission (YYYY-MM-DD) for patient Name"],
  "issue_count": 2
}
```

## Implementation
See `core/agents.py` → `timeline_agent()` function.
