"""
Migration Hooks Module
Safety hooks that run after all agents complete to make the BLOCK / PASS decision.
"""


ISSUE_THRESHOLD = 3  # Maximum allowed issues before migration is blocked


def migration_hook(agent_results: list[dict]) -> dict:
    """
    Migration Hook — aggregates issues from all agents and decides
    whether the migration should proceed.

    Rules:
      - Sum all issue_count values across agents
      - If total issues > ISSUE_THRESHOLD → BLOCK migration
      - Otherwise → PASS migration

    Returns a dict with status, total issues, and threshold used.
    """
    total_issues = sum(r.get("issue_count", 0) for r in agent_results)

    if total_issues > ISSUE_THRESHOLD:
        status = "BLOCK"
        message = (
            f"Migration BLOCKED: {total_issues} issues found "
            f"(threshold: {ISSUE_THRESHOLD}). "
            f"Please fix the flagged records before retrying."
        )
    else:
        status = "PASS"
        message = (
            f"Migration PASSED: {total_issues} issues found "
            f"(within threshold of {ISSUE_THRESHOLD}). "
            f"Data is ready for migration."
        )

    return {
        "status": status,
        "total_issues": total_issues,
        "threshold": ISSUE_THRESHOLD,
        "message": message,
    }
