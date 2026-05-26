# Billing Agent

## Role
Validates financial and insurance data in hospital migration files.

## Responsibilities
1. Detect missing or null insurance providers
2. Detect negative billing amounts

## Input
Pandas DataFrame with columns: Name, Insurance Provider, Billing Amount

## Output
```json
{
  "agent": "Billing Agent",
  "issues": ["Row N: description"],
  "issue_count": 0
}
```

## Rules
- Insurance values of "", "nan", "None", "NaN", "none" are treated as missing
- Billing amount must be a non-negative number
- Each issue message must include the row number and patient name
- This agent does NOT check demographics or dates

## Implementation
`core/agents.py` → `billing_agent(df)`
