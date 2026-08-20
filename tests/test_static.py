import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'

EXPECTED = {
    'youtube': ('YouTube', 'YouTube_CIDR.txt', 'YouTube_RouterOS.rsc', 'YouTube_DNS'),
    'telegram': ('Telegram', 'Telegram-CIDR.txt', 'Telegram_RouterOS.rsc', 'Telegram_DNS'),
    'meta': ('Meta', 'Meta_CIDR.txt', 'Meta_RouterOS.rsc', 'Meta_DNS'),
    'chatgpt': ('ChatGPT', 'ChatGPT_CIDR.txt', 'ChatGPT_RouterOS.rsc', 'ChatGPT_DNS'),
    'discord': ('Discord', 'Discord_CIDR', 'Discord_RouterOS.rsc', 'Discord_DNS'),
    'netflix': ('Netflix', 'Netflix_CIDR.txt', 'Netflix_RouterOS.rsc', 'Netflix_DNS'),
    'services': ('Services', 'Services_CIDR.txt', 'Services_RouterOS.rsc', 'Services_DNS'),
}


class ServiceListsStaticTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((SITE / 'services.json').read_text(encoding='utf-8'))
        cls.index = (SITE / 'index.html').read_text(encoding='utf-8')
        cls.service = (SITE / 'service.html').read_text(encoding='utf-8')
        cls.js = (SITE / 'assets' / 'app.js').read_text(encoding='utf-8')
        cls.css = (SITE / 'assets' / 'style.css').read_text(encoding='utf-8')
        cls.workflow = (ROOT / '.github' / 'workflows' / 'pages.yml').read_text(encoding='utf-8')

    def test_manifest_has_exact_seven_services(self):
        self.assertEqual(self.manifest['owner'], 'DKHNV')
        self.assertEqual(len(self.manifest['services']), 7)
        self.assertEqual({s['key'] for s in self.manifest['services']}, set(EXPECTED))

    def test_manifest_uses_real_file_names(self):
        services = {s['key']: s for s in self.manifest['services']}
        for key, (repo, cidr, routeros, dns) in EXPECTED.items():
            item = services[key]
            self.assertEqual(item['repo'], repo)
            self.assertEqual(item['files']['cidr'], cidr)
            self.assertEqual(item['files']['routeros'], routeros)
            self.assertEqual(item['files']['dns'], dns)

    def test_site_is_static_and_reads_raw_github(self):
        self.assertIn('https://raw.githubusercontent.com', self.js)
        self.assertIn('https://api.github.com/repos', self.js)
        self.assertNotIn('Flask', self.js + self.index + self.service)

    def test_api_metadata_is_cached(self):
        self.assertIn('15 * 60 * 1000', self.js)
        self.assertIn('localStorage', self.js)
        self.assertIn('pushed_at', self.js)

    def test_stats_ignore_comments_and_blank_lines(self):
        self.assertIn("!line.startsWith('#')", self.js)
        self.assertRegex(self.js, r'countCidr')
        self.assertRegex(self.js, r'countRouterOS')
        self.assertRegex(self.js, r'countDns')

    def test_service_page_has_three_tabs(self):
        for tab in ('cidr', 'routeros', 'dns'):
            self.assertIn(f'data-tab="{tab}"', self.service)
            self.assertIn(f'data-panel="{tab}"', self.service)

    def test_download_uses_blob_not_secret_backend(self):
        self.assertIn('new Blob', self.js)
        self.assertIn('URL.createObjectURL', self.js)

    def test_remote_content_is_rendered_as_text(self):
        self.assertIn('code.textContent = data.files[type]', self.js)
        self.assertNotIn('code.innerHTML = data.files[type]', self.js)

    def test_github_dark_palette(self):
        for value in ('#0d1117', '#161b22', '#30363d', '#58a6ff', '#3fb950'):
            self.assertIn(value, self.css)

    def test_pages_workflow_uses_current_actions(self):
        for action in ('actions/checkout@v6', 'actions/configure-pages@v5', 'actions/upload-pages-artifact@v4', 'actions/deploy-pages@v4'):
            self.assertIn(action, self.workflow)
        self.assertIn('path: site', self.workflow)
        self.assertNotIn('schedule:', self.workflow)

    def test_russian_ui_and_brand(self):
        combined = self.index + self.service
        for text in ('Списки сервисов', 'Последнее обновление', 'Скачать', 'Создано DKHNV'):
            self.assertIn(text, combined)
        self.assertIn('Service Lists', combined)

    def test_project_pages_links_are_relative(self):
        combined = self.index + self.service
        self.assertIn('href="assets/style.css"', combined)
        self.assertIn('src="assets/app.js"', combined)
        self.assertIn('href="index.html"', combined)
        self.assertNotIn('href="/assets/', combined)
        self.assertNotIn('src="/assets/', combined)

    def test_no_external_css_or_js_frameworks(self):
        combined = self.index + self.service
        self.assertNotIn('bootstrap', combined.lower())
        self.assertNotIn('tailwind', combined.lower())
        self.assertNotIn('jquery', combined.lower())
        scripts = re.findall(r'<script[^>]+src="([^"]+)"', combined)
        self.assertTrue(all(not src.startswith(('http://', 'https://')) for src in scripts))


if __name__ == '__main__':
    unittest.main()
