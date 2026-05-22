"""
Validation Agents Module
Each agent is a specialised function that inspects one domain of the migration data.
Returns a structured dict with agent name, list of issue descriptions, and count.
"""

import pandas as pd
from datetime import datetime


# ── Valid reference values ──────────────────────────────────────
VALID_GENDERS = {"Male", "Female", "Other"}
VALID_BLOOD_TYPES = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}


def demographic_agent(df: pd.DataFrame) -> dict:
    """
    Demographic Agent — validates patient demographic fields.
    Checks:
      - Age must be between 0 and 120 (inclusive)
      - Gender must be Male / Female / Other
      - Blood Type must be a valid ABO-Rh combination
    """
    issues = []

    for idx, row in df.iterrows():
        row_num = idx + 2  # +2 because idx is 0-based and row 1 is the header

        # Age validation
        try:
            age = float(row["Age"])
            if age < 0 or age > 120:
                issues.append(f"Row {row_num}: Invalid age ({int(age)}) for patient {row['Name']}")
        except (ValueError, TypeError):
            issues.append(f"Row {row_num}: Non-numeric age for patient {row['Name']}")

        # Gender validation
        gender = str(row.get("Gender", "")).strip()
        if gender not in VALID_GENDERS:
            issues.append(f"Row {row_num}: Invalid gender '{gender}' for patient {row['Name']}")

        # Blood type validation
        blood = str(row.get("Blood Type", "")).strip()
        if blood not in VALID_BLOOD_TYPES:
            issues.append(f"Row {row_num}: Invalid blood type '{blood}' for patient {row['Name']}")

    return {
        "agent": "Demographic Agent",
        "issues": issues,
        "issue_count": len(issues),
    }


def billing_agent(df: pd.DataFrame) -> dict:
    """
    Billing Agent — validates financial and insurance fields.
    Checks:
      - Insurance Provider must not be missing, empty, or 'None'
      - Billing Amount must be >= 0
    """
    issues = []

    for idx, row in df.iterrows():
        row_num = idx + 2

        # Missing insurance check
        insurance = str(row.get("Insurance Provider", "")).strip()
        if insurance in ("", "nan", "None", "NaN", "none"):
            issues.append(f"Row {row_num}: Missing insurance for patient {row['Name']}")

        # Negative billing check
        try:
            amount = float(row["Billing Amount"])
            if amount < 0:
                issues.append(
                    f"Row {row_num}: Negative billing amount (Rs.{amount:,.0f}) for patient {row['Name']}"
                )
        except (ValueError, TypeError):
            issues.append(f"Row {row_num}: Invalid billing amount for patient {row['Name']}")

    return {
        "agent": "Billing Agent",
        "issues": issues,
        "issue_count": len(issues),
    }


def timeline_agent(df: pd.DataFrame) -> dict:
    """
    Timeline Agent — validates admission and discharge date consistency.
    Checks:
      - Discharge Date must not be before Date of Admission
      - Date of Admission must not be in the future
    """
    issues = []
    today = datetime.now()

    for idx, row in df.iterrows():
        row_num = idx + 2

        admission = row.get("Date of Admission")
        discharge = row.get("Discharge Date")

        # Parse dates if they are strings
        try:
            if isinstance(admission, str):
                admission = pd.to_datetime(admission)
            if isinstance(discharge, str):
                discharge = pd.to_datetime(discharge)
        except Exception:
            issues.append(f"Row {row_num}: Unparseable dates for patient {row['Name']}")
            continue

        # Check if dates are valid (not NaT)
        if pd.isna(admission) or pd.isna(discharge):
            issues.append(f"Row {row_num}: Missing date values for patient {row['Name']}")
            continue

        # Discharge before admission
        if discharge < admission:
            issues.append(
                f"Row {row_num}: Discharge ({discharge.strftime('%Y-%m-%d')}) "
                f"before admission ({admission.strftime('%Y-%m-%d')}) "
                f"for patient {row['Name']}"
            )

        # Future admission
        if admission > pd.Timestamp(today):
            issues.append(
                f"Row {row_num}: Future admission date ({admission.strftime('%Y-%m-%d')}) "
                f"for patient {row['Name']}"
            )

    return {
        "agent": "Timeline Agent",
        "issues": issues,
        "issue_count": len(issues),
    }


def statistics_agent(df: pd.DataFrame) -> dict:
    """
    Statistics Agent — computes summary statistics for the migration dataset.
    No validation issues — purely informational.
    """
    total_patients = len(df)

    # Average billing amount
    try:
        avg_bill = float(df["Billing Amount"].mean())
    except Exception:
        avg_bill = 0.0

    # Top medical condition
    try:
        top_condition = df["Medical Condition"].value_counts().idxmax()
        top_condition_count = int(df["Medical Condition"].value_counts().max())
    except Exception:
        top_condition = "N/A"
        top_condition_count = 0

    # Gender distribution
    try:
        gender_dist = df["Gender"].value_counts().to_dict()
    except Exception:
        gender_dist = {}

    # Age statistics
    try:
        avg_age = float(df["Age"].mean())
        min_age = int(df["Age"].min())
        max_age = int(df["Age"].max())
    except Exception:
        avg_age, min_age, max_age = 0.0, 0, 0

    return {
        "agent": "Statistics Agent",
        "issues": [],
        "issue_count": 0,
        "statistics": {
            "total_patients": total_patients,
            "average_bill": round(avg_bill, 2),
            "top_condition": top_condition,
            "top_condition_count": top_condition_count,
            "gender_distribution": gender_dist,
            "average_age": round(avg_age, 1),
            "min_age": min_age,
            "max_age": max_age,
        },
    }
