from backend import app


def test_env_list_uses_default_when_variable_empty(monkeypatch):
    monkeypatch.setenv("PLANTIT_TEST_EMPTY", "")

    result = app._env_list("PLANTIT_TEST_EMPTY", ("http://example.com",))

    assert result == ["http://example.com"]


def test_env_list_uses_values_when_present(monkeypatch):
    monkeypatch.setenv(
        "PLANTIT_TEST_VALUES",
        "http://localhost:5580, http://127.0.0.1:5580",
    )

    result = app._env_list(
        "PLANTIT_TEST_VALUES", ("http://example.com", "http://fallback")
    )

    assert result == ["http://localhost:5580", "http://127.0.0.1:5580"]
