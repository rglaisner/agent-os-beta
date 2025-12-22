import unittest
from core.database import init_db, engine, Base


class TestDatabase(unittest.TestCase):
    def test_init_db(self):
        try:
            init_db()
            self.assertTrue(True)
        except Exception as e:
            self.fail(f"init_db raised exception: {e}")


if __name__ == "__main__":
    unittest.main()
