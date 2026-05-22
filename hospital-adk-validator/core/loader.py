"""
CSV Loader Module
Handles reading and normalising uploaded hospital migration CSV files.
"""

import pandas as pd
from io import BytesIO


def load_csv(file_bytes: bytes) -> pd.DataFrame:
    """
    Read uploaded CSV bytes into a pandas DataFrame.
    Normalises column names to stripped, title-cased format.
    Parses date columns automatically.
    """
    df = pd.read_csv(
        BytesIO(file_bytes),
        parse_dates=["Date of Admission", "Discharge Date"],
        dayfirst=False,
    )

    # Strip whitespace from column names
    df.columns = df.columns.str.strip()

    # Strip whitespace from string columns
    str_cols = df.select_dtypes(include=["object"]).columns
    for col in str_cols:
        df[col] = df[col].str.strip()

    return df
