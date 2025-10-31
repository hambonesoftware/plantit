from __future__ import annotations

import os
import random

from locust import HttpUser, between, task


class PlantitReadUser(HttpUser):
    wait_time = between(0.5, 1.5)
    host = os.getenv("PLANTIT_API_BASE", "http://127.0.0.1:5581")

    @task(2)
    def healthcheck(self) -> None:
        self.client.get("/api/health", name="GET /api/health")

    @task(3)
    def dashboard(self) -> None:
        self.client.get("/api/dashboard", name="GET /api/dashboard")

    @task(3)
    def villages_and_plants(self) -> None:
        response = self.client.get("/api/villages", name="GET /api/villages")
        if not response.ok:
            return

        data = response.json()
        villages = data.get("villages", []) if isinstance(data, dict) else []
        if not villages:
            return

        village = random.choice(villages)
        village_id = village.get("id")
        if not village_id:
            return

        self.client.get(f"/api/villages/{village_id}", name="GET /api/villages/:id")
        self.client.get(
            f"/api/villages/{village_id}/plants",
            name="GET /api/villages/:id/plants",
        )

    @task(1)
    def today_tasks(self) -> None:
        self.client.get("/api/today", name="GET /api/today")
