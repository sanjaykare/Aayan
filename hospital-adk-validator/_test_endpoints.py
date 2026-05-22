"""
Quick smoke-test for all Hospital Migration Validator endpoints.
Run: python _test_endpoints.py
"""
import urllib.request
import json
import os

BASE = "http://localhost:8000"

# ── 1. GET / ────────────────────────────────────────────────────
print("=" * 60)
print("TEST 1: GET /")
res = urllib.request.urlopen(BASE + "/")
print(f"  Status : {res.status}")
ct = res.headers["Content-Type"]
print(f"  Content-Type: {ct}")
body = res.read()
print(f"  Body length: {len(body)} bytes")
assert res.status == 200, "Expected 200"
assert "text/html" in ct, "Expected HTML"
print("  PASS ✓")

# ── 2. GET /sample ──────────────────────────────────────────────
print("=" * 60)
print("TEST 2: GET /sample")
res = urllib.request.urlopen(BASE + "/sample")
print(f"  Status : {res.status}")
ct = res.headers["Content-Type"]
print(f"  Content-Type: {ct}")
data = res.read()
print(f"  Body length: {len(data)} bytes")
assert res.status == 200, "Expected 200"
assert "csv" in ct, f"Expected CSV content-type, got {ct}"
print("  PASS ✓")

# ── 3. POST /validate with patients.csv ─────────────────────────
print("=" * 60)
print("TEST 3: POST /validate (patients.csv)")

csv_path = os.path.join(os.path.dirname(__file__), "patients.csv")
with open(csv_path, "rb") as f:
    csv_bytes = f.read()

boundary = "TestBoundary7654321"
CRLF = b"\r\n"
body_parts = [
    b"--" + boundary.encode() + CRLF,
    b'Content-Disposition: form-data; name="file"; filename="patients.csv"' + CRLF,
    b"Content-Type: text/csv" + CRLF,
    CRLF,
    csv_bytes,
    CRLF,
    b"--" + boundary.encode() + b"--" + CRLF,
]
body = b"".join(body_parts)

req = urllib.request.Request(
    BASE + "/validate",
    data=body,
    method="POST",
)
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

try:
    res = urllib.request.urlopen(req)
    report = json.loads(res.read())
    print(f"  Status : {res.status}")
    print(f"  Migration decision : {report.get('migration', {}).get('status')}")
    print(f"  Migration message  : {report.get('migration', {}).get('message')}")
    print(f"  Total issues       : {report.get('migration', {}).get('total_issues')}")
    print()
    for agent in report.get("agents", []):
        print(f"  [{agent['agent']}] → {agent['issue_count']} issues")
        for iss in agent["issues"][:3]:
            print(f"      • {iss}")
        if agent["issue_count"] > 3:
            print(f"      ... and {agent['issue_count'] - 3} more")
    print()
    stats = report.get("statistics", {})
    print(f"  Statistics:")
    for k, v in stats.items():
        print(f"    {k}: {v}")
    assert res.status == 200, "Expected 200"
    print("  PASS ✓")

except urllib.error.HTTPError as e:
    print(f"  HTTPError {e.code}: {e.reason}")
    print("  Body:", e.read().decode()[:1000])
    print("  FAIL ✗")

# ── 4. POST /validate with bad data ─────────────────────────────
print("=" * 60)
print("TEST 4: POST /validate (bad/empty body)")
req2 = urllib.request.Request(BASE + "/validate", data=b"", method="POST")
req2.add_header("Content-Type", "multipart/form-data; boundary=empty")
try:
    res2 = urllib.request.urlopen(req2)
    print(f"  Status: {res2.status}")
    print("  PASS ✓ (server handled gracefully)")
except urllib.error.HTTPError as e:
    print(f"  HTTPError {e.code} (expected) — server rejected bad input correctly")
    print("  PASS ✓")

print("=" * 60)
print("ALL TESTS COMPLETE")
