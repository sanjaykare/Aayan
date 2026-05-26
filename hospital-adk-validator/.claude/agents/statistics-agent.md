# Statistics Agent

## Role
Computes summary statistics for the hospital migration dataset.
This agent is purely informational — it does not produce validation issues.

## Responsibilities
1. Count total patients
2. Calculate average billing amount
3. Identify the most common medical condition
4. Compute gender distribution
5. Calculate age statistics (average, min, max)

## Input
Pandas DataFrame with all patient columns

## Output
```json
{
  "agent": "Statistics Agent",
  "issues": [],
  "issue_count": 0,
  "statistics": {
    "total_patients": 100,
    "average_bill": 45000.50,
    "top_condition": "Diabetes",
    "top_condition_count": 12,
    "gender_distribution": {"Male": 52, "Female": 48},
    "average_age": 47.3,
    "min_age": 22,
    "max_age": 77
  }
}
```

## Rules
- This agent's issue_count is always 0
- Its results are NOT included in the migration hook calculation
- Statistics are displayed separately in the UI
- Handle edge cases gracefully (empty DataFrame, non-numeric values)

## Implementation
`core/agents.py` → `statistics_agent(df)`
