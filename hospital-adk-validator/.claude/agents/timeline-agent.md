# Timeline Agent

## Role
Validates admission and discharge date consistency in hospital migration files.

## Responsibilities
1. Detect discharge dates that occur before admission dates
2. Detect admission dates set in the future

## Input
Pandas DataFrame with columns: Name, Date of Admission, Discharge Date

## Output
```json
{
  "agent": "Timeline Agent",
  "issues": ["Row N: description"],
  "issue_count": 0
}
```

## Rules
- Dates are parsed automatically from CSV (YYYY-MM-DD format expected)
- "Future" is compared against the current system date at runtime
- Missing or unparseable dates are flagged as issues
- Each issue message must include the row number, dates, and patient name
- This agent does NOT check demographics, billing, or insurance

## Implementation
`core/agents.py` → `timeline_agent(df)`
