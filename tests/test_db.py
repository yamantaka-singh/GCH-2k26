def test_postgis_is_available(cur):
    cur.execute("SELECT PostGIS_Version() AS v")
    assert cur.fetchone()["v"]


def test_migration_table_records_applied_files(cur):
    cur.execute("SELECT name FROM schema_migration ORDER BY name")
    names = [row["name"] for row in cur.fetchall()]
    assert "001_extensions.sql" in names
