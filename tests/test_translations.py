import os
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TSX = ROOT / "node_modules" / ".bin" / "tsx"


class TranslationStorageTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "openrun.sqlite"
        self.env = os.environ.copy()
        self.env["OPENRUN_DB_PATH"] = str(self.db_path)

        seeded = subprocess.run(
            [str(TSX), "src/scripts/demo-data.ts"],
            cwd=ROOT,
            env=self.env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(seeded.returncode, 0, msg=seeded.stderr)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_translation_tables_are_populated(self):
        with sqlite3.connect(self.db_path) as con:
            software = con.execute("SELECT COUNT(*) FROM software_translations WHERE locale = 'zh'").fetchone()[0]
            analysis = con.execute(
                "SELECT COUNT(*) FROM software_analysis_translations WHERE locale = 'zh'"
            ).fetchone()[0]
            categories = con.execute("SELECT COUNT(*) FROM category_translations WHERE locale = 'zh'").fetchone()[0]
            tags = con.execute("SELECT COUNT(*) FROM tag_translations WHERE locale = 'zh'").fetchone()[0]

        self.assertEqual(software, 50)
        self.assertEqual(analysis, 50)
        self.assertEqual(categories, 22)
        self.assertGreater(tags, 0)

    def test_translation_integrity_check_passes(self):
        result = subprocess.run(
            [str(TSX), "scripts/check-translations.ts"],
            cwd=ROOT,
            env=self.env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        self.assertIn("Translations OK", result.stdout)

    def test_unpublished_translation_falls_back_to_english(self):
        with sqlite3.connect(self.db_path) as con:
            con.execute(
                """
                UPDATE software_translations
                SET status = 'draft'
                WHERE software_id = (SELECT id FROM software WHERE slug = 'atlas-cms')
                  AND locale = 'zh'
                """
            )
            con.commit()

        result = subprocess.run(
            [str(TSX), "scripts/check-fallback.ts"],
            cwd=ROOT,
            env=self.env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        self.assertIn("Translation fallback OK", result.stdout)


if __name__ == "__main__":
    unittest.main()
