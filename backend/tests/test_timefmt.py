import re
from app.util.timefmt import format_hhmmss, format_srt_timestamp


def test_format_hhmmss_basic():
    assert format_hhmmss(0) == "00:00:00"
    assert format_hhmmss(3.9) == "00:00:03"
    assert format_hhmmss(3661) == "01:01:01"


def test_format_srt_timestamp():
    ts = format_srt_timestamp(3.456)
    assert re.match(r"\d{2}:\d{2}:\d{2},\d{3}", ts)
    assert ts.startswith("00:00:03")
