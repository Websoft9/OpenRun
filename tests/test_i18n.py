import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TSX = ROOT / "node_modules" / ".bin" / "tsx"
CHECK_SCRIPT = ROOT / "scripts" / "check-i18n.ts"


class I18nCatalogTest(unittest.TestCase):
    def test_catalogs_have_matching_keys_and_placeholders(self):
        self.assertTrue(TSX.exists(), msg=f"tsx not found at {TSX}; run npm install first")

        result = subprocess.run(
            [str(TSX), str(CHECK_SCRIPT)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        self.assertIn("i18n catalogs OK", result.stdout)


if __name__ == "__main__":
    unittest.main()
