"""Друга частина (20.11.2026): нові групи B1, B2 для 4 тем і тема «Авто» A1–B2 зі scripts/new-words-b.txt.
Дублі (словацьке слово вже є в будь-якій групі, або однаковий переклад у групі) пропускаються; у групі рівно 100 слів."""
import glob, json, re, unicodedata
D = 'src/content/sk'
POS = {'n': 'noun', 'v': 'verb', 'a': 'adj', 'd': 'adv', 'u': 'num', 'p': 'phrase'}
THEMES = {'kuchyna': 'Кухня і їжа', 'dom': "Дім і сім'я", 'mesto': 'Місто і транспорт', 'cas': 'Числа, час, погода', 'auto': 'Авто й водійські права'}

def slug(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

seen_sk, seen_id = set(), set()
for f in glob.glob(f'{D}/*.json'):
    for w in json.load(open(f, encoding='utf8'))['words']:
        seen_sk.add(w['sk'].lower()); seen_id.add(w['id'])

sections, cur = {}, None
for line in open('scripts/new-words-b.txt', encoding='utf8'):
    line = line.rstrip('\n')
    if line.startswith('## '):
        cur = tuple(line[3:].split()); sections[cur] = []; continue
    if not line.strip() or line.startswith('#'): continue
    p = [x.strip() for x in line.split('|')]
    w = {'sk': p[0], 'ua': p[1], 'pos': POS[p[2]]}
    if len(p) > 3 and p[3]: w['gender'] = p[3]
    if len(p) > 4 and p[4]: w['skAlt'] = [a.strip() for a in p[4].split(',')]
    sections[cur].append(w)

bad = False
for (t, lvl), ws in sections.items():
    out, uas, skipped = [], set(), []
    for w in ws:
        if len(out) == 100: break
        if w['sk'].lower() in seen_sk or w['ua'] in uas:
            skipped.append(w['sk']); continue
        i = slug(w['sk'])
        while i in seen_id: i += '-2'
        seen_id.add(i); seen_sk.add(w['sk'].lower()); uas.add(w['ua'])
        out.append({'id': i, **w})
    print(f'{t} {lvl}: {len(out)} (пропущено дублів: {len(skipped)} {skipped[:8]})')
    if len(out) < 100: bad = True
    json.dump({'id': f'{t}-{lvl.lower()}', 'themeId': t, 'theme': THEMES[t], 'cefr': lvl, 'words': out},
              open(f'{D}/{t}-{lvl.lower()}.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
if bad: raise SystemExit('є групи з менш ніж 100 слів')
