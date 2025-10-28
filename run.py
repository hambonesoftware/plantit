"""Utility script to launch both backend and frontend services together."""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Dict, Iterable, Tuple

ROOT_DIR = Path(__file__).resolve().parent


class ManagedProcess:
    """Wrapper around an asyncio subprocess with streaming output."""

    def __init__(self, name: str, command: Iterable[str]):
        self.name = name
        self.command = list(command)
        self.process: asyncio.subprocess.Process | None = None
        self._stdout_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        env = os.environ.copy()
        self.process = await asyncio.create_subprocess_exec(
            *self.command,
            cwd=str(ROOT_DIR),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
        )
        print(f"[{self.name}] started (pid={self.process.pid}) -> {' '.join(self.command)}")
        if self.process.stdout is not None:
            self._stdout_task = asyncio.create_task(
                self._stream_output(self.process.stdout)
            )

    async def _stream_output(self, stream: asyncio.StreamReader) -> None:
        while True:
            line = await stream.readline()
            if not line:
                break
            print(f"[{self.name}] {line.decode(errors='replace').rstrip()}")

    async def wait(self) -> int:
        if self.process is None:
            raise RuntimeError("Process has not been started.")
        returncode = await self.process.wait()
        if self._stdout_task is not None:
            await self._stdout_task
        print(f"[{self.name}] exited with code {returncode}")
        return returncode

    async def terminate(self) -> None:
        if self.process is None:
            return
        if self.process.returncode is not None:
            return
        print(f"[{self.name}] terminating...")
        self.process.terminate()
        try:
            await asyncio.wait_for(self.process.wait(), timeout=5)
        except asyncio.TimeoutError:
            print(f"[{self.name}] did not exit after SIGTERM, sending SIGKILL")
            self.process.kill()
            await self.process.wait()
        if self._stdout_task is not None:
            await self._stdout_task


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Start the Plantit backend (FastAPI) and frontend (static server) together."
        )
    )
    parser.add_argument(
        "--backend-host",
        default="0.0.0.0",
        help="Host/interface for the backend uvicorn server (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--backend-port",
        default=8000,
        type=int,
        help="Port for the backend uvicorn server (default: 8000)",
    )
    parser.add_argument(
        "--backend-reload",
        action="store_true",
        help="Enable uvicorn auto-reload for backend development.",
    )
    parser.add_argument(
        "--frontend-host",
        default="0.0.0.0",
        help="Host/interface for the frontend static server (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--frontend-port",
        default=5173,
        type=int,
        help="Port for the frontend static server (default: 5173)",
    )
    parser.add_argument(
        "--frontend-single",
        action="store_true",
        help=(
            "Serve the frontend in single-page-app mode (routes fallback to index.html)."
        ),
    )
    return parser.parse_args()


def build_commands(args: argparse.Namespace) -> Dict[str, Tuple[str, ...]]:
    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.app:app",
        "--host",
        args.backend_host,
        "--port",
        str(args.backend_port),
    ]
    if args.backend_reload:
        backend_cmd.append("--reload")

    listen = f"{args.frontend_host}:{args.frontend_port}"
    frontend_cmd = [
        "npx",
        "serve",
        "frontend",
        "-l",
        listen,
    ]
    if args.frontend_single:
        frontend_cmd.append("-s")

    return {
        "backend": tuple(backend_cmd),
        "frontend": tuple(frontend_cmd),
    }


async def run_services(args: argparse.Namespace) -> int:
    commands = build_commands(args)
    processes = {
        name: ManagedProcess(name, command)
        for name, command in commands.items()
    }

    exit_code = 0
    try:
        for process in processes.values():
            await process.start()

        wait_tasks = {
            asyncio.create_task(proc.wait()): name
            for name, proc in processes.items()
        }

        done, pending = await asyncio.wait(
            wait_tasks.keys(), return_when=asyncio.FIRST_COMPLETED
        )

        # Determine which process ended first.
        first_task = next(iter(done))
        exit_code = first_task.result()

        # Cancel pending waiters and terminate associated processes.
        for task in pending:
            task.cancel()
            other_name = wait_tasks[task]
            other_proc = processes[other_name]
            await other_proc.terminate()

        # Ensure all waiting tasks are completed to avoid warnings.
        for task in pending:
            try:
                await task
            except asyncio.CancelledError:
                pass
    finally:
        await asyncio.gather(
            *(proc.terminate() for proc in processes.values()),
            return_exceptions=True,
        )

    return exit_code


def main() -> None:
    args = parse_args()
    try:
        exit_code = asyncio.run(run_services(args))
    except KeyboardInterrupt:
        print("Received interrupt, shutting down...")
        exit_code = 0
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
