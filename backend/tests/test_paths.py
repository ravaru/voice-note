from app.util.paths import ensure_app_dirs, INBOX_DIR, OUT_DIR, TMP_DIR


def test_ensure_app_dirs_creates_directories():
    ensure_app_dirs()
    assert INBOX_DIR.exists()
    assert OUT_DIR.exists()
    assert TMP_DIR.exists()
