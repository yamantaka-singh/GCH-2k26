def cameras_geojson(cur, *, department_id: int | None = None) -> dict:
    """COALESCE keeps the return shape stable when no camera matches; without it
    json_agg returns NULL and the frontend has to special-case it."""
    cur.execute(
        """
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geom)::json,
              'properties', json_build_object(
                'id', id,
                'name', name,
                'status', status::text,
                'kind', kind::text,
                'vendor', vendor,
                'department_id', department_id,
                'last_seen_at', last_seen_at
              )
            ) ORDER BY id), '[]'::json)
        ) AS fc
        FROM camera
        WHERE (%s::int IS NULL OR department_id = %s)
        """,
        (department_id, department_id),
    )
    return cur.fetchone()["fc"]


def coverage_gaps(cur, *, min_lon: float, min_lat: float, max_lon: float, max_lat: float,
                  cell_m: int = 500, radius_m: int = 300) -> list[dict]:
    """Grid cells whose centre has no active camera within radius_m.

    The grid is generated in EPSG:3857 so cell_m is metres, and the coverage test
    runs in 4326 geography, which is exact on the sphere. So radius_m is accurate
    while cell_m is not: at Gujarat's latitude (23.2N) Web Mercator overstates
    distance by ~8.7%, making a nominal 500 m cell about 460 m of real ground.

    ponytail: cell_m carries ~8.7% mercator distortion at this latitude. It sets
    the heatmap's display resolution, not whether a gap is a gap, so it is left
    alone. If cell size ever has to be metrically true, project the grid in
    EPSG:32643 (UTM 43N) instead of 3857 -- but note 43N only covers 72-78E, so
    Kutch and Saurashtra would need 32642, making the projection per-region.
    """
    cur.execute(
        """
        WITH bbox AS (
          SELECT ST_Transform(ST_MakeEnvelope(%(min_lon)s, %(min_lat)s,
                                              %(max_lon)s, %(max_lat)s, 4326), 3857) AS g
        ),
        grid AS (
          SELECT (ST_SquareGrid(%(cell_m)s, (SELECT g FROM bbox))).geom AS cell
        )
        SELECT ST_AsGeoJSON(ST_Transform(cell, 4326))::json AS cell
        FROM grid
        WHERE NOT EXISTS (
          SELECT 1 FROM camera c
          WHERE c.status = 'active'
            AND ST_DWithin(
                  c.geom,
                  ST_Transform(ST_Centroid(cell), 4326)::geography,
                  %(radius_m)s)
        )
        ORDER BY ST_YMin(cell), ST_XMin(cell)
        """,
        {"min_lon": min_lon, "min_lat": min_lat, "max_lon": max_lon, "max_lat": max_lat,
         "cell_m": cell_m, "radius_m": radius_m},
    )
    return [row["cell"] for row in cur.fetchall()]
