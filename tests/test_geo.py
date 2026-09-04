import pytest

from src.registry.cameras import create_camera
from src.registry.geo import cameras_geojson, coverage_gaps


def test_geojson_shape_and_properties(cur, department):
    create_camera(cur, department_id=department, name="Sector 18", lat=23.2156, lon=72.6369)
    fc = cameras_geojson(cur)
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 1
    feature = fc["features"][0]
    assert feature["geometry"]["type"] == "Point"
    assert feature["geometry"]["coordinates"][0] == 72.6369  # longitude first
    assert feature["properties"]["name"] == "Sector 18"
    assert feature["properties"]["status"] == "active"


def test_geojson_is_empty_collection_not_null(cur):
    fc = cameras_geojson(cur)
    assert fc["features"] == []


def test_geojson_filters_by_department(cur, department):
    cur.execute("INSERT INTO department (code, name) VALUES ('MUN', 'Municipal') RETURNING id")
    other = cur.fetchone()["id"]
    create_camera(cur, department_id=department, name="Police cam", lat=23.0, lon=72.0)
    create_camera(cur, department_id=other, name="Municipal cam", lat=23.1, lon=72.1)
    fc = cameras_geojson(cur, department_id=other)
    assert [f["properties"]["name"] for f in fc["features"]] == ["Municipal cam"]


def test_empty_area_is_entirely_gaps(cur):
    gaps = coverage_gaps(cur, min_lon=72.60, min_lat=23.20, max_lon=72.61, max_lat=23.21,
                         cell_m=500, radius_m=300)
    assert len(gaps) > 0
    assert gaps[0]["type"] == "Polygon"


def test_a_camera_removes_the_cell_it_covers(cur, department):
    box = dict(min_lon=72.60, min_lat=23.20, max_lon=72.61, max_lat=23.21)
    before = len(coverage_gaps(cur, cell_m=500, radius_m=1000, **box))
    create_camera(cur, department_id=department, name="Centre", lat=23.205, lon=72.605)
    after = len(coverage_gaps(cur, cell_m=500, radius_m=1000, **box))
    assert after < before


def test_inactive_cameras_do_not_count_as_coverage(cur, department):
    box = dict(min_lon=72.60, min_lat=23.20, max_lon=72.61, max_lat=23.21)
    baseline = len(coverage_gaps(cur, cell_m=500, radius_m=1000, **box))
    create_camera(cur, department_id=department, name="Broken", lat=23.205, lon=72.605,
                  status="decommissioned")
    assert len(coverage_gaps(cur, cell_m=500, radius_m=1000, **box)) == baseline


def test_state_wide_bbox_is_refused_rather_than_hanging(cur):
    """A 6x5 degree box at 500 m is ~1.3M polygons; it must fail fast."""
    with pytest.raises(ValueError, match="over the"):
        coverage_gaps(cur, min_lon=68.1, min_lat=20.1, max_lon=74.5, max_lat=24.7,
                      cell_m=500, radius_m=300)


def test_same_wide_bbox_is_allowed_at_a_coarser_cell(cur):
    cells = coverage_gaps(cur, min_lon=68.1, min_lat=20.1, max_lon=74.5, max_lat=24.7,
                          cell_m=20000, radius_m=300)
    assert 0 < len(cells) <= 10_000
