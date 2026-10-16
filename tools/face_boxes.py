# 사진마다 얼굴 위치를 Gemini로 찾아 out/faces.json 에 저장 (장면 사진을 같은 크기로 맞춰 자르기용)
import os, json, base64, urllib.request, glob, time, re
KEY = os.environ['GEMINI_API_KEY']
res = {}
files = sorted(glob.glob('ref/*.jpg') + glob.glob('out/*.png'))
for f in files:
    mt = 'image/png' if f.endswith('png') else 'image/jpeg'
    body = {'contents': [{'parts': [{'inline_data': {'mime_type': mt, 'data': base64.b64encode(open(f, 'rb').read()).decode()}},
             {'text': 'Detect the single main person\'s face (forehead hairline to chin, ear to ear). Return JSON only: {"box_2d":[ymin,xmin,ymax,xmax]} normalized 0-1000.'}]}],
            'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0}}
    for m in ('gemini-2.5-flash', 'gemini-2.5-pro'):
        try:
            req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=120) as r: t = json.load(r)['candidates'][0]['content']['parts'][0]['text']
            j = json.loads(re.search(r'\{.*\}', t, re.S).group(0)); b = j['box_2d'] if isinstance(j, dict) else j[0]['box_2d']
            res[os.path.basename(f)] = b; print(f, b); break
        except Exception as e: print('실패', f, m, str(e)[:150]); time.sleep(3)
json.dump(res, open('out/faces.json', 'w'), indent=1)
