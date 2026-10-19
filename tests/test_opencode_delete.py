import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "build" / "opencode_delete.py"


def create_db(db_path, directory):
    con = sqlite3.connect(db_path)
    con.executescript(
        f"""
        CREATE TABLE session (
            id TEXT PRIMARY KEY,
            title TEXT,
            slug TEXT,
            directory TEXT,
            time_created INTEGER
        );
        CREATE TABLE message (session_id TEXT);
        CREATE TABLE part (session_id TEXT);
        CREATE TABLE session_message (session_id TEXT);
        CREATE TABLE session_input (session_id TEXT);
        CREATE TABLE todo (session_id TEXT);
        CREATE TABLE session_context_epoch (session_id TEXT);
        CREATE TABLE event (aggregate_id TEXT);
        INSERT INTO session VALUES ('sess-1', 'First Session', 'first', '{directory}', 1720000000000);
        INSERT INTO message VALUES ('sess-1');
        INSERT INTO part VALUES ('sess-1');
        INSERT INTO session_message VALUES ('sess-1');
        INSERT INTO session_input VALUES ('sess-1');
        INSERT INTO todo VALUES ('sess-1');
        INSERT INTO session_context_epoch VALUES ('sess-1');
        INSERT INTO event VALUES ('sess-1');
        """
    )
    con.commit()
    con.close()


class OpencodeDeleteTest(unittest.TestCase):
    def test_dry_run_lists_without_deleting(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            db_path = temp_path / "opencode.db"
            create_db(db_path, str(temp_path))

            result = subprocess.run(
                ["python3", str(SCRIPT), "--db", str(db_path), "--all", "--dry-run"],
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertIn("1 session(s)", result.stdout)
            self.assertIn("Dry run: nothing deleted.", result.stdout)

            con = sqlite3.connect(db_path)
            count = con.execute("SELECT COUNT(*) FROM session").fetchone()[0]
            con.close()
            self.assertEqual(count, 1)

    def test_yes_deletes_session_and_children(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            db_path = temp_path / "opencode.db"
            create_db(db_path, str(temp_path))

            result = subprocess.run(
                ["python3", str(SCRIPT), "--db", str(db_path), "--all", "--yes"],
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertIn("Deleted 1 session(s)", result.stdout)

            con = sqlite3.connect(db_path)
            session_count = con.execute("SELECT COUNT(*) FROM session").fetchone()[0]
            child_count = con.execute("SELECT COUNT(*) FROM message").fetchone()[0]
            event_count = con.execute("SELECT COUNT(*) FROM event").fetchone()[0]
            con.close()
            self.assertEqual(session_count, 0)
            self.assertEqual(child_count, 0)
            self.assertEqual(event_count, 0)


if __name__ == "__main__":
    unittest.main()