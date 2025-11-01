"""Service interface contracts that back the MVVM view models.

These protocols codify the read-path boundaries between FastAPI route handlers
and the persistence layer.  Implementations may source data from databases,
external APIs, or cached aggregates, but they must honour the shapes documented
in ``docs/mvvm-contracts.md``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Protocol, Sequence

__all__ = [
    "DashboardSummary",
    "DashboardAlert",
    "VillageSummary",
    "VillageFilterState",
    "DailyTask",
    "PlantDetail",
    "PlantEvent",
    "DashboardReadService",
    "VillageReadService",
    "TodayTaskService",
    "PlantDetailService",
]


@dataclass(frozen=True)
class DashboardSummary:
    """High-level dashboard metrics."""

    totalPlants: int
    activeVillages: int
    successRate: float
    upcomingTasks: int


@dataclass(frozen=True)
class DashboardAlert:
    """An actionable alert surfaced on the dashboard."""

    id: str
    level: str  # "info" | "warning" | "critical"
    message: str
    relatedPlantId: Optional[str] = None


@dataclass(frozen=True)
class VillageSummary:
    """Compact representation of a plant village."""

    id: str
    name: str
    climate: str
    plantCount: int
    healthScore: float
    bannerImageUrls: Sequence[str] = field(default_factory=tuple)


@dataclass(frozen=True)
class VillageFilterState:
    """Applied filters used when retrieving villages."""

    searchTerm: str = ""
    climateZones: Sequence[str] = field(default_factory=tuple)
    minHealth: Optional[float] = None


@dataclass(frozen=True)
class DailyTask:
    """A task scheduled for the current day."""

    id: str
    type: str  # "water" | "fertilize" | "inspect" | "transplant"
    plantId: str
    plantName: str
    villageName: str
    dueAt: datetime
    priority: str  # "low" | "medium" | "high"


@dataclass(frozen=True)
class PlantDetail:
    """Detailed plant metadata used in the modal."""

    id: str
    displayName: str
    species: str
    villageName: str
    lastWateredAt: datetime
    healthScore: float
    notes: str
    imageUrl: Optional[str] = None


@dataclass(frozen=True)
class PlantEvent:
    """Timeline entry for a plant."""

    id: str
    occurredAt: datetime
    type: str  # "watering" | "fertilizer" | "inspection" | "transfer" | "note"
    summary: str


class DashboardReadService(Protocol):
    """Read-only contract for dashboard data needs."""

    async def fetch_summary(self, *, correlation_id: str) -> DashboardSummary:
        """Return the hero metrics for the dashboard."""

    async def fetch_alerts(self, *, correlation_id: str) -> Sequence[DashboardAlert]:
        """Return outstanding alerts ordered by priority."""


class VillageReadService(Protocol):
    """Read-only contract for the villages view."""

    async def list_villages(
        self,
        *,
        filters: VillageFilterState,
        correlation_id: str,
    ) -> Sequence[VillageSummary]:
        """Retrieve villages matching the provided filters."""

    async def get_village(
        self,
        village_id: str,
        *,
        correlation_id: str,
    ) -> Optional[VillageSummary]:
        """Return a single village summary when available."""


class TodayTaskService(Protocol):
    """Read-only contract for today's task list."""

    async def list_tasks(self, *, correlation_id: str) -> Sequence[DailyTask]:
        """Return tasks scheduled for the current day."""


class PlantDetailService(Protocol):
    """Read-only contract for plant modal contents."""

    async def get_detail(
        self,
        plant_id: str,
        *,
        correlation_id: str,
    ) -> Optional[PlantDetail]:
        """Fetch the core plant detail, or ``None`` if missing."""

    async def get_timeline(
        self,
        plant_id: str,
        *,
        correlation_id: str,
    ) -> Sequence[PlantEvent]:
        """Return the timeline events for a plant ordered newest first."""
