import os
import shutil
import signal
import socket
import stat
import subprocess
import tempfile
import textwrap
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def write_file(path: Path, content: str, mode: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    if mode is not None:
      path.chmod(mode)


def create_app_stub(workspace: Path) -> None:
    src = workspace / "src"
    public = workspace / "public"
    dist = workspace / "dist"
    data = workspace / "data"
    src.mkdir(parents=True, exist_ok=True)
    public.mkdir(parents=True, exist_ok=True)
    dist.mkdir(parents=True, exist_ok=True)
    data.mkdir(parents=True, exist_ok=True)
    write_file(src / "server.tsx", "export {}\n")
    write_file(public / "app.css", "body {}\n")
    write_file(data / "openrun.sqlite", "stub\n")
    write_file(
        dist / "server.js",
        textwrap.dedent(
            """
            import http from 'node:http'

            const port = Number(process.env.PORT || 3000)
            const server = http.createServer((_req, res) => {
              res.end('ok')
            })

            server.listen(port, '127.0.0.1')

            const shutdown = () => {
              server.close(() => process.exit(0))
            }

            process.on('SIGTERM', shutdown)
            process.on('SIGINT', shutdown)

            setInterval(() => {}, 1000)
            """
        ).strip()
        + "\n",
    )


def create_fake_bin(bin_dir: Path, workspace: Path) -> None:
    state_dir = workspace / ".test-bin-state"
    state_dir.mkdir(parents=True, exist_ok=True)

    write_file(
        bin_dir / "npm",
        textwrap.dedent(
            f"""#!/usr/bin/env bash
            set -e
            script="$2"
            echo "$@" >> "{state_dir / 'npm.log'}"
            case "$script" in
              build)
                mkdir -p dist
                ;;
              db:init)
                mkdir -p data
                printf 'db-init\n' >> "{state_dir / 'db-init.log'}"
                ;;
              *)
                ;;
            esac
            exit 0
            """
        ),
        0o755,
    )

    write_file(
        bin_dir / "opencode",
        textwrap.dedent(
            f"""#!/usr/bin/env bash
            set -e
            printf 'HTTP_PROXY=%s\n' "${{HTTP_PROXY:-}}" > "{state_dir / 'opencode.log'}"
            printf 'HTTPS_PROXY=%s\n' "${{HTTPS_PROXY:-}}" >> "{state_dir / 'opencode.log'}"
            printf 'NO_PROXY=%s\n' "${{NO_PROXY:-}}" >> "{state_dir / 'opencode.log'}"
            printf 'no_proxy=%s\n' "${{no_proxy:-}}" >> "{state_dir / 'opencode.log'}"
            printf 'GITHUB_PAT=%s\n' "${{GITHUB_PAT:-}}" >> "{state_dir / 'opencode.log'}"
            printf 'CONTEXT7_API_KEY=%s\n' "${{CONTEXT7_API_KEY:-}}" >> "{state_dir / 'opencode.log'}"
            """
        ),
        0o755,
    )


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_port(port: int, timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = subprocess.run(
            ["lsof", f"-i:{port}"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0 and f":{port} (LISTEN)" in result.stdout:
            return
        time.sleep(0.1)
    raise AssertionError(f"port {port} did not start listening in time")


class MakeTargetsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)
        shutil.copy2(ROOT / "Makefile", self.temp_path / "Makefile")
        shutil.copytree(ROOT / "build", self.temp_path / "build")
        create_app_stub(self.temp_path)
        self.bin_dir = self.temp_path / "bin"
        self.bin_dir.mkdir()
        create_fake_bin(self.bin_dir, self.temp_path)
        self.env = os.environ.copy()
        self.env["PATH"] = f"{self.bin_dir}:{self.env['PATH']}"

    def tearDown(self) -> None:
        for pid_file in (self.temp_path / ".run").glob("*.pid") if (self.temp_path / ".run").exists() else []:
            try:
                pid = int(pid_file.read_text().strip())
                os.kill(pid, signal.SIGTERM)
            except (ProcessLookupError, ValueError, OSError):
                pass
        self.temp_dir.cleanup()

    def make(self, *args: str, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["make", *args],
            cwd=self.temp_path,
            capture_output=True,
            text=True,
            input=input_text,
            env=self.env,
            check=False,
        )

    def test_help_lists_targets_and_mentions_build_before_start(self):
        result = self.make("help")

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("app-start", result.stdout)
        self.assertIn("start on p=9000 or next free port when p is omitted", result.stdout)
        self.assertIn("build and start on 9000 or next free port above 9000", result.stdout)
        self.assertIn("▸ Build & Data", result.stdout)
        self.assertIn("▸ Dev", result.stdout)
        self.assertIn("▸ Config & Setup", result.stdout)
        self.assertIn("\n\n  \033[1;35m▸ Dev", result.stdout)
        self.assertIn("\n\n  \033[1;35m▸ Config & Setup", result.stdout)

    def test_build_and_db_init_targets_run_npm_scripts(self):
        build_result = self.make("build")
        db_init_result = self.make("db-init")

        self.assertEqual(build_result.returncode, 0, msg=build_result.stderr)
        self.assertEqual(db_init_result.returncode, 0, msg=db_init_result.stderr)

        npm_log = (self.temp_path / ".test-bin-state" / "npm.log").read_text()
        self.assertIn("run build", npm_log)
        self.assertIn("run db:init", npm_log)
        self.assertTrue((self.temp_path / ".test-bin-state" / "db-init.log").exists())

    def test_connector_writes_contentful_secret_file(self):
        result = self.make("connector", "PROVIDER=contentful", input_text="\ntoken-123\n")

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        secret_file = self.temp_path / ".secrets" / "contentful.env"
        self.assertTrue(secret_file.exists())
        self.assertEqual(secret_file.read_text(), "CONTENTFUL_ACCESS_TOKEN=token-123\n")
        mode = stat.S_IMODE(os.stat(secret_file).st_mode)
        self.assertEqual(mode, 0o600)

    def test_connector_writes_github_and_context7_secret_files(self):
        github_result = self.make("connector", "PROVIDER=github", input_text="\nghp-123\n")
        context7_result = self.make("connector", "PROVIDER=context7", input_text="\nctx-123\n")

        self.assertEqual(github_result.returncode, 0, msg=github_result.stderr)
        self.assertEqual(context7_result.returncode, 0, msg=context7_result.stderr)
        self.assertEqual(
            (self.temp_path / ".secrets" / "github.env").read_text(),
            "GITHUB_PAT=ghp-123\n",
        )
        self.assertEqual(
            (self.temp_path / ".secrets" / "context7.env").read_text(),
            "CONTEXT7_API_KEY=ctx-123\n",
        )

    def test_opencode_target_loads_secrets(self):
        secrets_dir = self.temp_path / ".secrets"
        secrets_dir.mkdir()
        (secrets_dir / "github.env").write_text("GITHUB_PAT=ghp-test\n")
        (secrets_dir / "context7.env").write_text("CONTEXT7_API_KEY=ctx-test\n")

        result = self.make("opencode")

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        opencode_log = (self.temp_path / ".test-bin-state" / "opencode.log").read_text()
        self.assertIn("GITHUB_PAT=ghp-test", opencode_log)
        self.assertIn("CONTEXT7_API_KEY=ctx-test", opencode_log)

    def test_opencode_target_clears_proxy_environment_for_command(self):
        env = self.env.copy()
        env["HTTP_PROXY"] = "http://proxy.example"
        env["HTTPS_PROXY"] = "https://secure-proxy.example"

        result = subprocess.run(
            ["make", "opencode"],
            cwd=self.temp_path,
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        opencode_log = (self.temp_path / ".test-bin-state" / "opencode.log").read_text()
        self.assertIn("HTTP_PROXY=", opencode_log)
        self.assertIn("HTTPS_PROXY=", opencode_log)
        self.assertIn("NO_PROXY=*", opencode_log)
        self.assertIn("no_proxy=*", opencode_log)

    def test_opencode_clear_dry_run_uses_python_script(self):
        db_path = self.temp_path / "opencode.db"
        con = subprocess.run(
            [
                "sqlite3",
                str(db_path),
                "CREATE TABLE session (id TEXT PRIMARY KEY, title TEXT, slug TEXT, directory TEXT, time_created INTEGER);"
                "CREATE TABLE message (session_id TEXT);"
                "CREATE TABLE part (session_id TEXT);"
                "CREATE TABLE session_message (session_id TEXT);"
                "CREATE TABLE session_input (session_id TEXT);"
                "CREATE TABLE todo (session_id TEXT);"
                "CREATE TABLE session_context_epoch (session_id TEXT);"
                "CREATE TABLE event (aggregate_id TEXT);"
                f"INSERT INTO session VALUES ('sess-1', 'First Session', 'first', '{self.temp_path}', 1720000000000);",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(con.returncode, 0, msg=con.stderr)

        result = self.make("opencode-clear", f"ARGS=--db {db_path} --all --dry-run")

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("1 session(s)", result.stdout)
        self.assertIn("Dry run: nothing deleted.", result.stdout)

    def test_app_lifecycle_targets_work(self):
        port = free_port()

        start_result = self.make("app-start", f"p={port}")
        self.assertEqual(start_result.returncode, 0, msg=start_result.stderr)
        self.assertIn("run build", (self.temp_path / ".test-bin-state" / "npm.log").read_text())
        self.assertIn(f"OpenRun started on port {port}", start_result.stdout)

        wait_for_port(port)

        status_result = self.make("app-status", f"p={port}")
        self.assertEqual(status_result.returncode, 0, msg=status_result.stderr)
        self.assertIn("Source: managed", status_result.stdout)
        self.assertIn(str(port), status_result.stdout)

        list_result = self.make("app-list")
        self.assertEqual(list_result.returncode, 0, msg=list_result.stderr)
        self.assertIn(str(port), list_result.stdout)
        self.assertIn("running", list_result.stdout)

        second_start_result = self.make("app-start", f"p={port}")
        self.assertEqual(second_start_result.returncode, 0, msg=second_start_result.stderr)
        self.assertIn("already running", second_start_result.stdout)

        restart_result = self.make("app-restart", f"p={port}")
        self.assertEqual(restart_result.returncode, 0, msg=restart_result.stderr)
        self.assertIn(f"Stopped OpenRun on port {port}", restart_result.stdout)
        self.assertIn(f"OpenRun started on port {port}", restart_result.stdout)

        wait_for_port(port)

        stop_result = self.make("app-stop", f"p={port}")
        self.assertEqual(stop_result.returncode, 0, msg=stop_result.stderr)
        self.assertIn(f"Stopped OpenRun on port {port}", stop_result.stdout)

        status_after_stop = self.make("app-status", f"p={port}")
        self.assertEqual(status_after_stop.returncode, 0, msg=status_after_stop.stderr)
        self.assertIn(f"No OpenRun app is listening on port {port}", status_after_stop.stdout)


if __name__ == "__main__":
    unittest.main()
