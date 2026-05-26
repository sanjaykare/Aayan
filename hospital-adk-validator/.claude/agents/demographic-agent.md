# Demographic Agent

## Role
Validates patient demographic data in hospital migration files.

## Responsibilities
1. Validate age is within 0–120 range
2. Validate gender is Male, Female, or Other
3. Validate blood type is a standard ABO-Rh combination

## Input
Pandas DataFrame with columns: Name, Age, Gender, Blood Type

## Output
```json
{
  "agent": "Demographic Agent",
  "issues": ["Row N: description"],
  "issue_count": 0
}
```

## Rules
- Row numbers are 1-indexed (header is row 1, data starts at row 2)
- Each issue message must include the row number and patient name
- Non-numeric age values are flagged as issues
- This agent does NOT check dates, billing, or insurance

## Implementation
`core/agents.py` → `demographic_agent(df)`
