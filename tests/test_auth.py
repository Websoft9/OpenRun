import http.cookiejar
import os
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NODE = os.environ.get("NODE_BIN", "node")


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_for_http(url: str, timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, ConnectionError):
            pass
        time.sleep(0.1)
    raise AssertionError(f"server did not become ready at {url}")


class AuthFlowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise AssertionError(result.stderr or result.stdout)

    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "openrun.sqlite"
        self.env = os.environ.copy()
        self.env["OPENRUN_DB_PATH"] = str(self.db_path)
        self.env["BETTER_AUTH_SECRET"] = "test-better-auth-secret"
        self.server = None
        self.base = ""

        init = subprocess.run(
            [NODE, str(ROOT / "dist" / "scripts" / "init-db.js"), "--reset"],
            cwd=ROOT,
            env=self.env,
            capture_output=True,
            text=True,
            check=False,
        )
        if init.returncode != 0:
            raise AssertionError(init.stderr or init.stdout)

    def tearDown(self) -> None:
        if self.server is not None:
            self.server.terminate()
            try:
                self.server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server.kill()
                self.server.wait(timeout=5)
        self.temp_dir.cleanup()

    def start_server(self) -> str:
        port = free_port()
        self.base = f"http://127.0.0.1:{port}"
        self.env["BETTER_AUTH_URL"] = self.base
        self.server = subprocess.Popen(
            [NODE, str(ROOT / "dist" / "server.js")],
            cwd=ROOT,
            env={**self.env, "PORT": str(port)},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        wait_for_http(f"{self.base}/en")
        return self.base

    def opener(self):
        jar = http.cookiejar.CookieJar()
        return jar, urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    def get(self, opener, path: str):
        with opener.open(self.base + path, timeout=10) as response:
            return response.status, response.geturl(), response.read().decode("utf-8")

    def post(self, opener, path: str, data: dict[str, str]):
        body = urllib.parse.urlencode(data).encode("utf-8")
        request = urllib.request.Request(self.base + path, data=body, method="POST")
        with opener.open(request, timeout=10) as response:
            return response.status, response.geturl(), response.read().decode("utf-8")

    def test_register_login_logout_and_protected_account(self):
        self.start_server()
        jar, opener = self.opener()
        email = f"auth-{uuid.uuid4().hex[:10]}@example.com"
        password = "password123"

        status, url, _ = self.get(opener, "/en/account")
        self.assertEqual(status, 200)
        self.assertIn("/en/login", url)

        status, url, html = self.post(
            opener,
            "/en/register",
            {
                "name": "Auth Test",
                "email": email,
                "password": password,
                "theme": "light",
                "next": "/en/account",
            },
        )
        self.assertEqual(status, 200)
        self.assertIn("/en/account", url)
        self.assertIn("Auth Test", html)
        self.assertTrue(any("better-auth" in cookie.name for cookie in jar))

        status, url, _ = self.post(opener, "/en/logout", {"theme": "light"})
        self.assertEqual(status, 200)
        self.assertIn("/en", url)
        self.assertFalse(any("better-auth" in cookie.name for cookie in jar))

        status, url, html = self.post(
            opener,
            "/en/login",
            {
                "email": email,
                "password": password,
                "theme": "light",
                "next": "/en/account",
            },
        )
        self.assertEqual(status, 200)
        self.assertIn("/en/account", url)
        self.assertIn("Auth Test", html)

    def test_duplicate_email_is_rejected(self):
        self.start_server()
        email = f"auth-{uuid.uuid4().hex[:10]}@example.com"
        password = "password123"

        _, opener = self.opener()
        status, _, _ = self.post(
            opener,
            "/en/register",
            {"name": "First User", "email": email, "password": password},
        )
        self.assertEqual(status, 200)

        _, second_opener = self.opener()
        status, url, _ = self.post(
            second_opener,
            "/en/register",
            {"name": "Second User", "email": email, "password": password},
        )
        self.assertEqual(status, 200)
        self.assertIn("error=email_taken", url)


if __name__ == "__main__":
    unittest.main()
