import pytest

from src.registry.cameras import count_cameras, list_cameras
from src.registry.importer import import_csv

GOOD = """name,lat,lon,vendor,external_ref
Sector 18 Junction,23.2156,72.6369,Hikvision,POL-001
Bus Depot Gate,23.2201,72.6410,Dahua,POL-002
"""


def test_imports_every_valid_row(cur, department):
    result = import_csv(cur, department, GOOD)
    assert result.inserted == 2
    assert result.errors == []
    assert count_cameras(cur, department_id=department) == 2
    assert list_cameras(cur)[0].vendor == "Hikvision"


def test_headers_are_case_and_space_insensitive(cur, department):
    result = import_csv(cur, department, " NAME , Lat , LON \nA,23.0,72.0\n")
    assert result.inserted == 1


def test_missing_required_header_raises(cur, department):
    with pytest.raises(ValueError, match="lon"):
        import_csv(cur, department, "name,lat\nA,23.0\n")


def test_bad_row_is_reported_and_others_still_import(cur, department):
    csv_text = (
        "name,lat,lon\n"
        "Good One,23.0,72.0\n"
        "Bad Coords,999,72.0\n"
        "Empty Name,,72.0\n"
        "Good Two,23.1,72.1\n"
    )
    result = import_csv(cur, department, csv_text)
    assert result.inserted == 2
    assert [line for line, _ in result.errors] == [3, 4]
    assert "out of range" in result.errors[0][1]


def test_duplicate_external_ref_is_reported_not_fatal(cur, department):
    csv_text = (
        "name,lat,lon,external_ref\n"
        "First,23.0,72.0,POL-001\n"
        "Duplicate,23.1,72.1,POL-001\n"
        "Third,23.2,72.2,POL-003\n"
    )
    result = import_csv(cur, department, csv_text)
    assert result.inserted == 2
    assert [line for line, _ in result.errors] == [3]


def test_non_numeric_fps_is_reported_not_silently_dropped(cur, department):
    result = import_csv(cur, department, "name,lat,lon,fps\nCam,23.0,72.0,25fps\n")
    assert result.inserted == 0
    assert result.errors == [(2, "fps must be a whole number, got '25fps'")]


def test_numeric_fps_and_retention_are_stored(cur, department):
    result = import_csv(
        cur, department, "name,lat,lon,fps,retention_days\nCam,23.0,72.0,25,15\n"
    )
    assert result.inserted == 1
    assert result.errors == []
    stored = list_cameras(cur)[0]
    assert (stored.fps, stored.retention_days) == (25, 15)
