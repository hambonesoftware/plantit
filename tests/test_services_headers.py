from __future__ import annotations

import sys
from pathlib import Path
from typing import Sequence

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.headers import (
    HeaderSearchService,
    LlmAttachment,
    SpecNotFoundError,
    StoredSpec,
)


class InMemorySpecRepository:
    def __init__(self, specs: dict[str, StoredSpec]):
        self._specs = dict(specs)

    def get(self, spec_id: str) -> StoredSpec | None:
        return self._specs.get(spec_id)


class RecordingLlm:
    def __init__(self):
        self.calls = []

    def chat(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: Sequence[LlmAttachment],
    ):
        self.calls.append(
            {
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
                "attachments": list(attachments),
            }
        )
        return {"status": "ok"}


@pytest.fixture
def stored_spec():
    return StoredSpec(
        spec_id="1",
        filename="document.pdf",
        media_type="application/pdf",
        content=b"%PDF-1.7\n...",
    )


def test_header_search_attaches_spec_blob(stored_spec):
    repository = InMemorySpecRepository({stored_spec.spec_id: stored_spec})
    llm = RecordingLlm()
    service = HeaderSearchService(repository, llm)

    result = service.search(stored_spec.spec_id, prompt="List headers")

    assert result == {"status": "ok"}
    assert len(llm.calls) == 1
    call = llm.calls[0]
    assert call["system_prompt"].startswith("You are an assistant")
    assert call["user_prompt"] == "List headers"
    attachments = call["attachments"]
    assert len(attachments) == 1
    attachment = attachments[0]
    assert isinstance(attachment, LlmAttachment)
    assert attachment.filename == "document.pdf"
    assert attachment.media_type == "application/pdf"
    assert attachment.content == stored_spec.content


def test_header_search_missing_spec_raises():
    repository = InMemorySpecRepository({})
    llm = RecordingLlm()
    service = HeaderSearchService(repository, llm)

    with pytest.raises(SpecNotFoundError):
        service.search("missing", prompt="List headers")
