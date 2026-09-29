"""Run with fonttools+brotli installed. Retain used ligatures and their metrics."""
from pathlib import Path
import json
import re
from fontTools.ttLib import TTFont
from fontTools import subset

root = Path(__file__).resolve().parents[1]
source = root / 'node_modules/@fontsource-variable/material-symbols-rounded/files/material-symbols-rounded-latin-wght-normal.woff2'
font = TTFont(source)
text = '\n'.join(p.read_text(encoding='utf-8') for p in (root/'src').rglob('*') if p.suffix in ('.ts','.tsx'))
# Include literals and JSX text, plus metadata labels used dynamically as icon names.
words = set(re.findall(r'\b[a-z][a-z_0-9]+\b', text))
cmap = font.getBestCmap()
chars = {glyph:chr(code) for code,glyph in cmap.items() if code < 128}
keep=set(chars)
icons=[]
for lookup in font['GSUB'].table.LookupList.Lookup:
    for table in lookup.SubTable:
        table = getattr(table, 'ExtSubTable', table)
        for first, ligatures in getattr(table,'ligatures',{}).items():
            for ligature in ligatures:
                name=''.join(chars.get(g,'?') for g in [first]+ligature.Component)
                if name in words:
                    keep.add(ligature.LigGlyph)
                    icons.append(name)
options=subset.Options()
if not icons:
    raise RuntimeError('Nenhuma ligadura encontrada; não publicar fonte vazia.')
options.layout_closure=False
options.flavor='woff2'
subsetter=subset.Subsetter(options=options)
subsetter.populate(glyphs=keep)
subsetter.subset(font)
output=root/'src/assets/material-symbols-subset.woff2'
output.parent.mkdir(parents=True,exist_ok=True)
font.save(output)
report={'beforeBytes':source.stat().st_size,'afterBytes':output.stat().st_size,'icons':sorted(set(icons))}
(root/'qa-evidence/structure/icons.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='icons'}))
