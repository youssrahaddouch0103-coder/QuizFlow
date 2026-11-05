import httpx

from app import llm as llm_module
from app.config import Settings
from app.llm import OpenAICompatibleClient

SETTINGS = Settings(provider="groq", api_key="k", base_url="https://x/v1", model="m", timeout_seconds=5, max_attempts=2)


def _response(status, content=None, text=""):
    req = httpx.Request("POST", "https://x/v1/chat/completions")
    if content is not None:
        return httpx.Response(status, json={"choices": [{"message": {"content": content}}]}, request=req)
    return httpx.Response(status, text=text, request=req)


def test_retries_without_json_mode_when_unsupported(monkeypatch):
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append("response_format" in json)
        if "response_format" in json:
            return _response(400, text="response_format is not supported")
        return _response(200, content='```json\n{"questions": []}\n```')

    monkeypatch.setattr(llm_module.httpx, "post", fake_post)
    assert OpenAICompatibleClient(SETTINGS).complete_json("s", "u") == {"questions": []}
    assert calls == [True, False]
