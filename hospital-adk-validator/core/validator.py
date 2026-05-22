"""
Validator Orchestrator
Coordinates all agents and the migration hook into a single validation pipeline.
"""

import pandas as pd

from core.agents import (
    demographic_agent,
    billing_agent,
    timeline_agent,
    statistics_agent,
)
from core.hooks import migration_hook


def run_validation(df: pd.DataFrame) -> dict:
    """
    Run the full validation pipeline on a patient DataFrame.

    Steps:
      1. Run each specialised agent
      2. Run the migration hook to decide BLOCK / PASS
      3. Return the combined report

    Returns a dict containing agent results, migration decision, and statistics.
    """

    # Step 1: Run all validation agents
    demographic_result = demographic_agent(df)
    billing_result = billing_agent(df)
    timeline_result = timeline_agent(df)
    statistics_result = statistics_agent(df)

    # Collect validation agents (statistics is informational, not validation)
    validation_results = [demographic_result, billing_result, timeline_result]

    # Step 2: Run migration hook on validation results only
    migration_decision = migration_hook(validation_results)

    # Step 3: Assemble the full report
    report = {
        "agents": [
            demographic_result,
            billing_result,
            timeline_result,
        ],
        "statistics": statistics_result.get("statistics", {}),
        "migration": migration_decision,
    }

    return report
