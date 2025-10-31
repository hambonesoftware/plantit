"""Services for running header searches against stored specification files."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

__all__ = [
    "SpecNotFoundError",
    "StoredSpec",
    "LlmAttachment",
    "SpecRepository",
    "HeaderSearchLlm",
    "HeaderSearchService",
]


class SpecNotFoundError(RuntimeError):
    """Raised when a specification document cannot be located."""

    def __init__(self, spec_id: str) -> None:
        super().__init__(f"Specification not found: {spec_id}")
        self.spec_id = spec_id


@dataclass(frozen=True, slots=True)
class StoredSpec:
    """Representation of a stored specification document."""

    spec_id: str
    filename: str
    media_type: str
    content: bytes


@dataclass(frozen=True, slots=True)
class LlmAttachment:
    """Binary payload sent alongside an LLM prompt."""

    filename: str
    content: bytes
    media_type: str


class SpecRepository(Protocol):
    """Persistence boundary for retrieving specification documents."""

    def get(self, spec_id: str) -> StoredSpec | None:
        """Return the stored document for *spec_id* or ``None`` when missing."""


class HeaderSearchLlm(Protocol):
    """Capability exposed by LLM clients used for header searches."""

    def chat(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: Sequence[LlmAttachment],
    ) -> object:
        """Execute the header search conversation."""


class HeaderSearchService:
    """Coordinate header searches by combining stored specs with LLM prompts."""

    _SYSTEM_PROMPT = "You are an assistant that extracts section headers from specification documents."

    def __init__(self, repository: SpecRepository, llm: HeaderSearchLlm) -> None:
        self._repository = repository
        self._llm = llm

    def search(self, spec_id: str, *, prompt: str) -> object:
        """Execute a header search for *spec_id* using the supplied user *prompt*."""

        stored_spec = self._repository.get(spec_id)
        if stored_spec is None:
            raise SpecNotFoundError(spec_id)

        attachment = LlmAttachment(
            filename=stored_spec.filename,
            content=stored_spec.content,
            media_type=stored_spec.media_type,
        )

        return self._llm.chat(
            system_prompt=self._SYSTEM_PROMPT,
            user_prompt=prompt,
            attachments=[attachment],
        )
