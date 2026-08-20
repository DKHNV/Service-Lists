import json, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"

class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((SITE / "services.json").read_text(encoding="utf-8"))
        cls.index = (SITE / "index.html").read_text(encoding="utf-8")
        cls.service = (SITE / "service.html").read_text(encoding="utf-8")
        cls.js = (SITE / "assets" / "app.js").read_text(encoding="utf-8")
        cls.readme = (ROOT / "README.md").read_text(encoding="utf-8")

    def test_exact_seven_public_services(self):
        self.assertEqual(
            [s["key"] for s in self.manifest["services"]],
            ["youtube", "telegram", "meta", "chatgpt", "claude", "discord", "netflix"],
        )

    def test_services_private_repo_not_exposed(self):
        combined = json.dumps(self.manifest, ensure_ascii=False) + self.index + self.readme
        self.assertNotIn('"Services"', combined)
        self.assertNotIn('Services_CIDR', combined)
        self.assertNotIn('Services_RouterOS', combined)
        self.assertNotIn('Services_DNS', combined)

    def test_main_page_human_copy(self):
        for text in (
            "Я собрал здесь списки IP-сетей и доменов",
            "Какие списки здесь есть",
            "Как пользоваться сайтом",
            "Выберите сервис, чтобы открыть его списки",
        ):
            self.assertIn(text, self.index)

    def test_main_page_avoids_old_robotic_copy(self):
        for text in (
            "Сайт ничего не скрывает",
            "не преобразует в фоне",
            "каталог данных",
            "в своей сетевой схеме",
        ):
            self.assertNotIn(text, self.index)

    def test_formats_present(self):
        for text in ("CIDR", "RouterOS", "DNS"):
            self.assertIn(text, self.index)

    def test_readme_has_site_link_first(self):
        self.assertIn("https://dkhnv.github.io/Service-Lists/", self.readme[:200])

    def test_readme_has_no_services_repo(self):
        self.assertNotIn("\n- Services\n", self.readme)

    def test_version(self):
        self.assertIn("v1.1.1", self.index)
        self.assertIn("v1.1.1", self.service)

    def test_static_architecture_unchanged(self):
        self.assertIn("raw.githubusercontent.com", self.js)
        self.assertNotIn("Flask", self.index + self.service + self.js)

if __name__ == "__main__":
    unittest.main()
