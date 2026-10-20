import base64
import json
import os
import socket
import sqlite3
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request
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


def request_json(url: str, method: str = "GET", payload=None, headers=None):
    data = None
    request_headers = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, method=method, headers=request_headers)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8")
        try:
            return error.code, json.loads(body)
        except json.JSONDecodeError:
            return error.code, {"raw": body}


class WorkflowTest(unittest.TestCase):
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
        self.env["ADMIN_TOKEN"] = "test-admin"
        self.env["SUBMISSION_ENRICH"] = "0"
        self.env["TRUST_PROXY"] = "1"
        self.server = None

    def tearDown(self) -> None:
        if self.server is not None:
            self.server.terminate()
            try:
                self.server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server.kill()
                self.server.wait(timeout=5)
        self.temp_dir.cleanup()

    def run_script(self, script: str, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [NODE, str(ROOT / "dist" / "scripts" / script), *args],
            cwd=ROOT,
            env=self.env,
            capture_output=True,
            text=True,
            check=False,
        )

    def query(self, sql: str):
        con = sqlite3.connect(self.db_path)
        try:
            return con.execute(sql).fetchall()
        finally:
            con.close()

    def start_server(self) -> str:
        port = free_port()
        self.server = subprocess.Popen(
            [NODE, str(ROOT / "dist" / "server.js")],
            cwd=ROOT,
            env={**self.env, "PORT": str(port)},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        base = f"http://127.0.0.1:{port}"
        wait_for_http(f"{base}/en")
        return base

    def test_reference_seed_demo_and_import_are_separate_and_idempotent(self):
        init = self.run_script("init-db.js", "--reset")
        self.assertEqual(init.returncode, 0, msg=init.stderr or init.stdout)
        self.assertEqual(self.query("SELECT COUNT(*) FROM software")[0][0], 0)
        self.assertEqual(self.query("SELECT COUNT(*) FROM categories")[0][0], 22)
        self.assertEqual(self.query("SELECT COUNT(*) FROM licenses")[0][0], 740)
        self.assertEqual(self.query("SELECT COUNT(*) FROM licenses WHERE is_osi_approved = 1")[0][0], 154)
        self.assertEqual(self.query("SELECT COUNT(*) FROM difficulty_levels")[0][0], 3)
        self.assertEqual(self.query("SELECT COUNT(*) FROM reserved_tags")[0][0], 5)

        again = self.run_script("init-db.js")
        self.assertEqual(again.returncode, 0, msg=again.stderr or again.stdout)
        self.assertEqual(self.query("SELECT COUNT(*) FROM categories")[0][0], 22)
        self.assertGreaterEqual(self.query("SELECT COUNT(*) FROM schema_migrations")[0][0], 1)

        demo = self.run_script("demo-data.js")
        self.assertEqual(demo.returncode, 0, msg=demo.stderr or demo.stdout)
        demo_again = self.run_script("demo-data.js")
        self.assertEqual(demo_again.returncode, 0, msg=demo_again.stderr or demo_again.stdout)
        self.assertEqual(self.query("SELECT COUNT(*) FROM software")[0][0], 50)
        self.assertEqual(self.query("SELECT COUNT(*) FROM software_categories")[0][0], 75)
        self.assertEqual(self.query("SELECT COUNT(*) FROM software_tags")[0][0], 150)

        catalog_file = Path(self.temp_dir.name) / "catalog.json"
        catalog_file.write_text(
            json.dumps(
                {
                    "products": [
                        {
                            "name": "Gitea",
                            "repository": "https://github.com/go-gitea/gitea",
                            "homepage": "https://about.gitea.com",
                            "license": "MIT",
                            "primaryLanguage": "Go",
                            "stars": 45000,
                            "categories": ["developer-tools"],
                            "tags": ["git", "self-hosted"],
                            "status": "published",
                            "summaryEn": "A lightweight self-hosted Git service.",
                            "summaryZh": "轻量级自托管 Git 服务。",
                            "featuresEn": ["Git hosting"],
                            "featuresZh": ["Git 托管"],
                            "useCasesEn": ["Internal source control"],
                            "useCasesZh": ["内部代码管理"],
                            "alternativesEn": ["GitLab"],
                            "alternativesZh": ["GitLab"],
                            "whyChooseEn": "Small footprint.",
                            "whyChooseZh": "资源占用低。",
                        }
                    ]
                }
            )
        )

        first_import = self.run_script("import-catalog.js", str(catalog_file))
        self.assertEqual(first_import.returncode, 0, msg=first_import.stderr or first_import.stdout)
        second_import = self.run_script("import-catalog.js", str(catalog_file))
        self.assertEqual(second_import.returncode, 0, msg=second_import.stderr or second_import.stdout)
        self.assertEqual(self.query("SELECT COUNT(*) FROM software WHERE slug = 'gitea'")[0][0], 1)
        self.assertEqual(
            self.query("SELECT status FROM software WHERE slug = 'gitea'")[0][0],
            "published",
        )

    def test_process_framework_api_and_pages(self):
        init = self.run_script("init-db.js", "--reset")
        self.assertEqual(init.returncode, 0, msg=init.stderr or init.stdout)
        base = self.start_server()

        status, level_one = request_json(f"{base}/api/processes?level=1&lang=en")
        self.assertEqual(status, 200, msg=level_one)
        self.assertEqual(len(level_one["items"]), 13)
        self.assertEqual(level_one["stats"]["total"], 159)
        self.assertEqual(level_one["stats"]["l3"], 101)

        status, detail = request_json(f"{base}/api/processes/9.0?lang=zh")
        self.assertEqual(status, 200, msg=detail)
        self.assertEqual(detail["item"]["process"]["name"], "管理财务资源")
        self.assertEqual(len(detail["item"]["process"]["children"]), 4)

        with urllib.request.urlopen(f"{base}/en/processes", timeout=10) as response:
            self.assertEqual(response.status, 200)
            body = response.read().decode("utf-8")
        self.assertIn("Process framework", body)
        self.assertIn("9.0", body)

    def test_submission_review_and_publish_flow(self):
        init = self.run_script("init-db.js", "--reset")
        self.assertEqual(init.returncode, 0, msg=init.stderr or init.stdout)
        base = self.start_server()
        admin_headers = {
            "Authorization": "Basic " + base64.b64encode(b"admin:test-admin").decode("ascii")
        }

        status, created = request_json(
            f"{base}/api/submissions",
            method="POST",
            payload={
                "repository": "https://github.com/example/demo-app",
                "homepage": "https://demo.example.com",
                "suggestedCategory": "collaboration",
                "note": "A demo app",
                "contact": "tester",
            },
            headers={"X-Forwarded-For": "203.0.113.10"},
        )
        self.assertEqual(status, 201, msg=created)
        token = created["submission"]["token"]
        self.assertEqual(created["submission"]["status"], "submitted")

        status, duplicate = request_json(
            f"{base}/api/submissions",
            method="POST",
            payload={"repository": "https://github.com/example/demo-app"},
            headers={"X-Forwarded-For": "203.0.113.11"},
        )
        self.assertEqual(status, 200, msg=duplicate)
        self.assertTrue(duplicate["duplicate"])
        self.assertEqual(duplicate["submission"]["token"], token)

        status, honeypot = request_json(
            f"{base}/api/submissions",
            method="POST",
            payload={
                "repository": "https://github.com/example/honeypot",
                "website": "spam.example",
            },
            headers={"X-Forwarded-For": "203.0.113.12"},
        )
        self.assertEqual(status, 202, msg=honeypot)

        status, private = request_json(
            f"{base}/api/submissions",
            method="POST",
            payload={"repository": "https://127.0.0.1/a/b"},
            headers={"X-Forwarded-For": "203.0.113.13"},
        )
        self.assertEqual(status, 400, msg=private)
        self.assertEqual(private["error"], "private_host")

        status, unauthorized = request_json(f"{base}/api/admin/submissions")
        self.assertEqual(status, 401, msg=unauthorized)

        status, accepted = request_json(
            f"{base}/api/admin/submissions/1",
            method="POST",
            payload={"action": "accept"},
            headers=admin_headers,
        )
        self.assertEqual(status, 200, msg=accepted)
        slug = accepted["softwareSlug"]
        self.assertEqual(accepted["item"]["status"], "accepted")

        status, blocked = request_json(
            f"{base}/api/admin/software/{slug}",
            method="POST",
            payload={"action": "publish"},
            headers=admin_headers,
        )
        self.assertEqual(status, 422, msg=blocked)
        self.assertEqual(blocked["error"], "publish_blocked")

        review = {
            "action": "publish",
            "name": "Demo App",
            "homepage": "https://demo.example.com",
            "repository": "https://github.com/example/demo-app",
            "license": "MIT",
            "primaryLanguage": "TypeScript",
            "stars": 10,
            "categorySlugs": ["collaboration"],
            "summaryEn": "Demo summary",
            "summaryZh": "演示摘要",
            "featuresEn": ["Fast"],
            "featuresZh": ["快速"],
            "useCasesEn": ["Testing"],
            "useCasesZh": ["测试"],
            "alternativesEn": ["Other"],
            "alternativesZh": ["其他"],
            "whyChooseEn": "Simple",
            "whyChooseZh": "简单",
            "deploymentDifficulty": "easy",
            "tags": ["demo"],
            "isFeatured": True,
        }
        status, published = request_json(
            f"{base}/api/admin/software/{slug}",
            method="POST",
            payload=review,
            headers=admin_headers,
        )
        self.assertEqual(status, 200, msg=published)
        self.assertTrue(published["published"])
        self.assertEqual(published["item"]["status"], "published")
        self.assertEqual(published["item"]["stars"], 10)
        self.assertTrue(published["item"]["isFeatured"])

        status, listing = request_json(f"{base}/api/software/{slug}")
        self.assertEqual(status, 200, msg=listing)
        self.assertEqual(listing["item"]["summary"], "Demo summary")

        status, tracked = request_json(f"{base}/api/submissions/{token}")
        self.assertEqual(status, 200, msg=tracked)
        self.assertEqual(tracked["item"]["status"], "published")

        status, duplicate_existing = request_json(
            f"{base}/api/submissions",
            method="POST",
            payload={"repository": "https://github.com/example/demo-app"},
            headers={"X-Forwarded-For": "203.0.113.14"},
        )
        self.assertEqual(status, 200, msg=duplicate_existing)
        self.assertTrue(duplicate_existing["duplicate"])
        self.assertEqual(duplicate_existing["submission"]["status"], "duplicate")

        status, second = request_json(
            f"{base}/api/submissions",
            method="POST",
            payload={"repository": "https://github.com/example/second-app"},
            headers={"X-Forwarded-For": "203.0.113.15"},
        )
        self.assertEqual(status, 201, msg=second)
        second_id = second["submission"]["token"]
        self.assertTrue(second_id)

        submissions = self.query("SELECT id FROM submissions WHERE status = 'submitted'")[0][0]
        status, rejected_without_reason = request_json(
            f"{base}/api/admin/submissions/{submissions}",
            method="POST",
            payload={"action": "reject"},
            headers=admin_headers,
        )
        self.assertEqual(status, 400, msg=rejected_without_reason)
        self.assertEqual(rejected_without_reason["error"], "reason_required")

        status, rejected = request_json(
            f"{base}/api/admin/submissions/{submissions}",
            method="POST",
            payload={"action": "reject", "reason": "Not a fit"},
            headers=admin_headers,
        )
        self.assertEqual(status, 200, msg=rejected)
        self.assertEqual(rejected["item"]["status"], "rejected")


if __name__ == "__main__":
    unittest.main()
