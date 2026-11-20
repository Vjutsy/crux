"""Збирає групи слів: A0 зливається в A1, нові слова з scripts/new-words.txt доповнюють кожну групу до 100.
Запуск: python3 scripts/build-words.py (одноразово, 20.11.2026)."""
import json, os, re, unicodedata
D = 'src/content/sk'
POS = {'n': 'noun', 'v': 'verb', 'a': 'adj', 'd': 'adv', 'u': 'num', 'p': 'phrase'}
TARGET = 100

def slug(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

new = {}
cur = None
for line in open('scripts/new-words.txt', encoding='utf8'):
    line = line.rstrip('\n')
    if line.startswith('## '):
        t, l = line[3:].split(); cur = (t, l); new[cur] = []; continue
    if not line.strip() or line.startswith('#'): continue
    parts = [p.strip() for p in line.split('|')]
    sk, ua, pos = parts[0], parts[1], POS[parts[2]]
    w = {'sk': sk, 'ua': ua, 'pos': pos}
    if len(parts) > 3 and parts[3]: w['gender'] = parts[3]
    if len(parts) > 4 and parts[4]: w['skAlt'] = [a.strip() for a in parts[4].split(',')]
    new[cur].append(w)

load = lambda t, l: json.load(open(f'{D}/{t}-{l}.json', encoding='utf8'))
seen_sk, seen_id, problems = {}, set(), []
out = {}
for t in ['kuchyna', 'dom', 'mesto', 'cas']:
    a0, a1, a2 = load(t, 'a0'), load(t, 'a1'), load(t, 'a2')
    for lvl, base in (('A1', a0['words'] + a1['words']), ('A2', a2['words'])):
        words = list(base) + new[(t, lvl)]
        words = words[:TARGET]
        if len(words) < TARGET: problems.append(f'{t} {lvl}: лише {len(words)}')
        uas = {}
        for w in words:
            key = w['sk'].lower()
            if key in seen_sk: problems.append(f'дубль sk «{w["sk"]}» у {t} {lvl} і {seen_sk[key]}')
            seen_sk[key] = f'{t} {lvl}'
            if w['ua'] in uas: problems.append(f'дубль ua «{w["ua"]}» у {t} {lvl}')
            uas[w['ua']] = 1
            i = w.get('id') or slug(w['sk'])
            while i in seen_id: i += '-2'
            w = {'id': i, **{k: v for k, v in w.items() if k != 'id'}}
            seen_id.add(i)
            out.setdefault((t, lvl), []).append(w)
        theme = a0['theme']
        out[(t, lvl)] = {'id': f'{t}-{lvl.lower()}', 'themeId': t, 'theme': theme, 'cefr': lvl, 'words': out[(t, lvl)]}
        print(t, lvl, len(words), 'з них нових', max(0, len(words) - len(base)), 'зайвих', len(base) + len(new[(t, lvl)]) - len(words))
if problems:
    print('\n'.join(problems)); raise SystemExit(1)
for t in ['kuchyna', 'dom', 'mesto', 'cas']:
    os.remove(f'{D}/{t}-a0.json')
    for lvl in ('A1', 'A2'):
        json.dump(out[(t, lvl)], open(f'{D}/{t}-{lvl.lower()}.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
print('готово')
