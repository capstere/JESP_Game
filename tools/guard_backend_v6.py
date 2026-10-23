from pathlib import Path
r=Path(__file__).resolve().parents[1]
p=r/'agents/runner.mjs';s=p.read_text().replace("const names=args.files||[args.name].filter(Boolean);", "const names=(Array.isArray(args.files)?args.files:typeof args.name==='string'?[args.name]:[]).filter(n=>typeof n==='string');")
p.write_text(s)
p=r/'agents/app.mjs';s=p.read_text().replace("if(e instanceof TypeError)return 'Nätverksfel eller blockerad webbläsaranslutning. '+e.message;", "if(e instanceof TypeError&&/fetch|network|load failed/i.test(e.message))return 'Nätverksfel eller blockerad webbläsaranslutning. '+e.message;")
p.write_text(s)
