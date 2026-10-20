import os
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NODE = os.environ.get("NODE_BIN", "node")


class ContentfulSeedTest(unittest.TestCase):
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
        self.env.pop("CONTENTFUL_ACCESS_TOKEN", None)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def seed(self) -> subprocess.CompletedProcess:
        return subprocess.run(
            [NODE, str(ROOT / "dist" / "scripts" / "seed-contentful.js")],
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

    def test_contentful_snapshot_seeds_catalog_products_and_licenses(self):
        result = self.seed()
        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        self.assertIn("Contentful seed applied", result.stdout)

        self.assertEqual(self.query("SELECT COUNT(*) FROM software")[0][0], 386)
        self.assertEqual(self.query("SELECT COUNT(*) FROM software WHERE status = 'published'")[0][0], 116)
        self.assertEqual(self.query("SELECT COUNT(*) FROM software WHERE status = 'draft'")[0][0], 270)
        self.assertEqual(self.query("SELECT COUNT(*) FROM categories WHERE external_id <> ''")[0][0], 134)
        self.assertEqual(
            self.query("SELECT COUNT(*) FROM categories WHERE external_id <> '' AND parent_id IS NULL")[0][0],
            18,
        )
        self.assertGreater(self.query("SELECT COUNT(*) FROM category_parents")[0][0], 100)
        self.assertEqual(self.query("SELECT COUNT(*) FROM licenses")[0][0], 740)
        self.assertEqual(self.query("SELECT COUNT(*) FROM licenses WHERE is_osi_approved = 1")[0][0], 154)
        self.assertEqual(
            self.query("SELECT is_osi_approved FROM licenses WHERE spdx_id = 'MIT'")[0][0],
            1,
        )
        self.assertEqual(
            self.query("SELECT is_osi_approved FROM licenses WHERE spdx_id = 'SSPL-1.0'")[0][0],
            0,
        )
        license_columns = [row[1] for row in self.query("PRAGMA table_info(licenses)")]
        self.assertEqual(license_columns, ['spdx_id', 'name', 'is_osi_approved', 'reference_url'])
        self.assertEqual(self.query("SELECT COUNT(*) FROM languages")[0][0], 836)
        self.assertEqual(
            self.query("SELECT primary_language FROM software WHERE slug = 'semaphoreui'")[0][0],
            "Go",
        )
        self.assertEqual(
            self.query("SELECT COUNT(*) FROM software WHERE primary_language <> 'Unknown' AND primary_language NOT IN (SELECT name FROM languages)")[0][0],
            0,
        )
        shell_aliases = self.query("SELECT aliases_json FROM languages WHERE name = 'Shell'")[0][0]
        self.assertIn("unix shell", shell_aliases)
        self.assertEqual(self.query("SELECT COUNT(*) FROM markets")[0][0], 225)
        self.assertEqual(
            self.query("SELECT COUNT(*) FROM software WHERE NOT EXISTS (SELECT 1 FROM software_markets sm WHERE sm.software_id = software.id)")[0][0],
            0,
        )
        self.assertEqual(
            self.query("SELECT COUNT(*) FROM software_markets WHERE market_code = 'GLOBAL'")[0][0],
            386,
        )
        self.assertEqual(self.query("SELECT COUNT(*) FROM platforms")[0][0], 15)
        self.assertEqual(self.query("SELECT COUNT(*) FROM software_platforms")[0][0], 401)
        self.assertEqual(
            self.query("SELECT COUNT(*) FROM software WHERE NOT EXISTS (SELECT 1 FROM software_platforms sp WHERE sp.software_id = software.id)")[0][0],
            0,
        )
        self.assertEqual(
            self.query("SELECT COUNT(*) FROM software_platforms WHERE platform_code IN ('linux/unspecified', 'windows/unspecified')")[0][0],
            401,
        )
        self.assertEqual(self.query("SELECT COUNT(*) FROM industries")[0][0], 22)
        self.assertEqual(
            self.query("SELECT COUNT(*) FROM software WHERE NOT EXISTS (SELECT 1 FROM software_industries si WHERE si.software_id = software.id)")[0][0],
            0,
        )
        self.assertEqual(
            self.query("SELECT COUNT(*) FROM software_industries WHERE industry_code = 'CROSS_INDUSTRY'")[0][0],
            386,
        )
        self.assertGreater(self.query("SELECT COUNT(*) FROM software_translations WHERE locale = 'zh'")[0][0], 0)

        semaphore = self.query(
            "SELECT status, license, external_id FROM software WHERE slug = 'semaphoreui'"
        )
        self.assertEqual(len(semaphore), 1)
        self.assertEqual(semaphore[0][0], "published")
        self.assertEqual(semaphore[0][1], "MIT")
        self.assertTrue(semaphore[0][2])

        xinference = self.query("SELECT status, repository FROM software WHERE slug = 'xinference'")
        self.assertEqual(xinference[0][0], "draft")
        self.assertIn("github.com/xorbitsai/inference", xinference[0][1])

        child = self.query(
            "SELECT parent_id FROM categories WHERE slug = 'orchestration'"
        )
        self.assertIsNotNone(child[0][0])

    def test_contentful_snapshot_seed_is_idempotent(self):
        first = self.seed()
        self.assertEqual(first.returncode, 0, msg=first.stderr or first.stdout)
        second = self.seed()
        self.assertEqual(second.returncode, 0, msg=second.stderr or second.stdout)

        self.assertEqual(self.query("SELECT COUNT(*) FROM software")[0][0], 386)
        self.assertEqual(self.query("SELECT COUNT(*) FROM categories WHERE external_id <> ''")[0][0], 134)
        self.assertEqual(self.query("SELECT COUNT(*) FROM category_parents")[0][0], 181)
        self.assertIn("updated: 386", second.stdout)


if __name__ == "__main__":
    unittest.main()
