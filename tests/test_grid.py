from src.registry.grid import grid_camera_id, load_credentials, rtsp_url, whep_url


def test_grid_camera_id_matches_only_the_cam_nn_pattern():
    assert grid_camera_id("cam01") == "cam01"
    assert grid_camera_id("CAM13") == "cam13"
    assert grid_camera_id("POL-001") is None
    assert grid_camera_id(None) is None


def test_urls_percent_encode_credentials():
    assert rtsp_url("cam04", "a@b.com", "p@ss") == \
        "rtsp://a%40b.com:p%40ss@103.250.160.189:8554/stream/cam04"
    assert whep_url("cam04", "a@b.com", "p@ss") == \
        "http://a%40b.com:p%40ss@103.250.160.189:8889/stream/cam04/whep"


def test_load_credentials_none_when_unset(monkeypatch):
    # load_dotenv() would otherwise repopulate these from the real dev .env.
    monkeypatch.setattr("src.registry.grid.load_dotenv", lambda: None)
    monkeypatch.delenv("RTSP_EMAIL", raising=False)
    monkeypatch.delenv("RTSP_PASSWORD", raising=False)
    assert load_credentials() is None


def test_load_credentials_reads_env(monkeypatch):
    monkeypatch.setenv("RTSP_EMAIL", "a@b.com")
    monkeypatch.setenv("RTSP_PASSWORD", "secret")
    assert load_credentials() == ("a@b.com", "secret")
