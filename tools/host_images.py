# 진행자(미소·한결) 표정·장면 사진 만들기 (Gemini 이미지 생성) — 기준 사진은 host-assets 가지의 ref/, 결과는 out/
import os, json, base64, urllib.request, time
KEY = os.environ['GEMINI_API_KEY']
ONLY = set(filter(None, os.environ.get('ONLY', '').split(',')))
os.makedirs('out', exist_ok=True)
LOG = open('out/log.txt', 'w')
def say(*a): print(*a); LOG.write(' '.join(map(str, a)) + '\n'); LOG.flush()
def models():
    with urllib.request.urlopen(f'https://generativelanguage.googleapis.com/v1beta/models?key={KEY}&pageSize=300', timeout=30) as r:
        ms = [m['name'].split('/')[-1] for m in json.load(r)['models']]
    img = [m for m in ms if 'image' in m and 'imagen' not in m]
    say('이미지 모델:', img)
    pref = [m for m in img if 'pro' in m] + [m for m in img if 'pro' not in m]
    return pref
COMMON = ('Keep EXACTLY the same person as the reference photo: same face, same hairstyle, same age, same outfit. '
          'Photorealistic editorial magazine photo, natural skin texture, shallow depth of field, warm soft light. '
          'Vertical 4:5 composition. No text, no logo, no watermark.')
SEATED = ('Same set as the reference: sitting at the light oak desk by the window in the bright living room, black podcast microphone on a boom arm, '
          'a few sheets of script paper and a ceramic coffee cup on the desk. Frame from the top of the head to just below the desk edge, face in the upper third. ')
EVE = ('Same living room and same outfit, but it is evening: orange sunset glow through the window, warm table-lamp light indoors, cozy mood. ')
JOBS = []
for who, ref_seat, ref_stand, desc in (('w', 'ws2_smile', 'w5_wave', 'the woman'), ('m', 'ms2_smile', 'm3_wave', 'the man')):
    JOBS += [
     (f'{who}s7_curious', ref_seat, SEATED + f'{desc} tilts her/his head slightly, rests fingers on the chin, looking at the camera with a curious playful smile.'),
     (f'{who}s8_secret', ref_seat, SEATED + f'{desc} leans toward the camera with an index finger on the lips, a mischievous "it is a secret" expression.'),
     (f'{who}s9_delight', ref_seat, SEATED + f'{desc} has put the script down and clasps both hands together, beaming with delight.'),
     (f'{who}s10_thumb', ref_seat, SEATED + f'{desc} looks at the camera and gives a thumbs-up with one hand, warm big smile.'),
     (f'{who}e1_wave', ref_stand, EVE + f'Standing, framed from the knees up, {desc} looks at the camera, waving one hand with a bright smile.'),
     (f'{who}e2_smile', ref_seat, EVE + SEATED.replace('in the bright living room', 'in the living room') + f'{desc} looks at the camera with a gentle warm smile.'),
     (f'{who}e3_read', ref_seat, EVE + SEATED.replace('in the bright living room', 'in the living room') + f'{desc} looks down at the script and is speaking into the microphone.'),
    ]
def gen(model, ref, prompt):
    img = base64.b64encode(open(f'ref/{ref}.jpg', 'rb').read()).decode()
    body = {'contents': [{'parts': [{'inline_data': {'mime_type': 'image/jpeg', 'data': img}}, {'text': prompt + ' ' + COMMON}]}],
            'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'], 'imageConfig': {'aspectRatio': '4:5'}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}',
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=240) as r: d = json.load(r)
    for p in d['candidates'][0]['content']['parts']:
        if 'inlineData' in p: return base64.b64decode(p['inlineData']['data'])
    raise RuntimeError('그림 없음: ' + json.dumps(d)[:300])
MS = models()
for name, ref, prompt in JOBS:
    if ONLY and name not in ONLY: continue
    for m in MS:
        try:
            data = gen(m, ref, prompt); open(f'out/{name}.png', 'wb').write(data); say('완료', name, m, len(data)); break
        except Exception as e:
            det = e.read().decode()[:300] if hasattr(e, 'read') else ''
            say('실패', name, m, str(e)[:150], det); time.sleep(5)
    time.sleep(3)
