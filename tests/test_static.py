import json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(c):
  c.m=json.loads((SITE/'services.json').read_text(encoding='utf-8'))
  c.i=(SITE/'index.html').read_text(encoding='utf-8')
  c.s=(SITE/'service.html').read_text(encoding='utf-8')
  c.j=(SITE/'assets'/'app.js').read_text(encoding='utf-8')
  c.c=(SITE/'assets'/'style.css').read_text(encoding='utf-8')
 def test_seven_services(self): self.assertEqual(len(self.m['services']),7)
 def test_descriptions(self): self.assertTrue(all(x.get('description') for x in self.m['services']))
 def test_russian_landing(self):
  for t in ('Что здесь находится','Как этим пользоваться','Доступные сервисы','Публичные сетевые списки'): self.assertIn(t,self.i)
 def test_three_formats(self):
  for t in ('CIDR','RouterOS','DNS'): self.assertIn(t,self.i)
 def test_copy(self):
  self.assertIn('data-copy',self.s); self.assertIn('navigator.clipboard.writeText',self.j); self.assertIn('Скопировано',self.j)
 def test_total_stats(self):
  for t in ('data-total-services','data-total-cidr','data-total-dns'): self.assertIn(t,self.i)
 def test_tab_counts(self):
  for t in ('cidr','routeros','dns'): self.assertIn(f'data-tab-count="{t}"',self.s)
 def test_source(self): self.assertIn('Источник данных',self.s); self.assertIn('GitHub Raw',self.s)
 def test_static(self):
  self.assertIn('raw.githubusercontent.com',self.j); self.assertNotIn('Flask',self.i+self.s+self.j)
 def test_safe_remote_text(self): self.assertIn('code.textContent=data.files[type]',self.j)
 def test_cache_15min(self): self.assertIn('15*60*1000',self.j)
 def test_project_relative_paths(self):
  for h in (self.i,self.s):
   self.assertIn('href="assets/style.css"',h); self.assertIn('src="assets/app.js"',h)
 def test_version(self): self.assertIn('v1.1.0',self.i+self.s)
 def test_human_text_not_router_instructions(self):
  self.assertNotIn('/ip firewall address-list',self.i+self.s)
  self.assertNotIn('добавьте правило', (self.i+self.s).lower())
if __name__=='__main__': unittest.main()
