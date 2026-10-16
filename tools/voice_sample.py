# 오프닝 목소리 견본 (Gemini TTS) — 문장 조각마다 따로 만들어 out_voice/{who}_{n}.wav 로 저장 (자막·장면 맞추기 쉽게)
import os, json, base64, urllib.request, wave, time
KEY = os.environ['GEMINI_API_KEY']
MODELS = ['gemini-3.1-flash-tts-preview']
ONLY = set(filter(None, os.environ.get('ONLY', '').split(',')))
PROFILE = {
 'miso': '[목소리 설정] 45세 한국 여성 진행자. 세련되고 생기 있는 사람. 맑고 탄력 있는 중음, 웃음이 잘 묻어남. 차분한 낭독조·나이 든 말투 금지.',
 'hangyeol': '[목소리 설정] 46세 한국 남성 진행자. 유쾌하고 센스 있는 사람. 따뜻한 중저음이지만 무겁지 않고 경쾌함. 느린 설명조·아저씨 말투 금지.',
}
STYLE = {
 'greet': '[연출] 하루를 여는 인사. 반갑고 밝게, 에너지가 넘치게, 듣는 사람 기분이 확 올라가도록 활짝 웃으며. 또렷하고 경쾌한 템포.',
 'story': '[연출] 친한 친구에게 "이거 들어 봐" 하고 이야기 들려주듯 가깝고 생기 있게. 차분하지만 늘어지지 않는 대화 빠르기. 웃긴 대목은 웃음을 참듯, 뭉클한 대목은 살짝 낮고 천천히. 따옴표 안의 쪽지·대사는 그 사람이 된 듯 실감 나게.',
 'close': '[연출] 듣는 사람에게 힘을 주는 마무리. 밝고 힘 있게, 말 걸듯이.',
}
VOICE = {'miso': 'Gacrux', 'hangyeol': 'Schedar'}
SEG = {
 "miso": [],
 "hangyeol": [
  ('greet', '오늘도 수고 많으셨어요, 한결입니다.'),
  ('greet', '토요일 저녁이에요. 오늘은 나한테 좋은 거 하나 해 주기로 해요. 일단 소파에서 제일 편한 자리부터 맡으시고요!'),
  ('story', '오늘 사연은 마흔아홉 지훈 씨예요. 중고거래 앱에 이십 년 묵은 통기타를 올렸대요. 대학 때 아르바이트비 모아서 산 기타. 이제 칠 일도 없다고, 오만 원에요.'),
  ('story', '바로 채팅이 왔는데요, 첫 마디가… 혹시 이 기타로 고백해 본 적 있으세요?'),
  ('story', '있죠, 딱 한 번. 성공했고요. 그렇게 답하고 약속 장소에 나갔더니…'),
  ('story', '열일곱 살 남학생이 서 있더래요. 다음 주 학교 축제에서, 좋아하는 친구 앞에서 노래를 한대요.'),
  ('story', '그 자리에서 한번 쳐 보라고 했더니… 코드를 딱 세 개 알더래요.'),
  ('story', '지훈 씨, 이십 년 만에 기타를 다시 받아 들었대요. 놀이터 벤치에서 한 시간 특훈. 오만 원은 안 받고, 조건을 하나 걸었대요. 결과 보고. 그리고 오늘 아침, 문자가 왔답니다.'),
  ('story', '아저씨, 이 기타 고백 성공률 백 퍼센트 맞네요.'),
  ('close', '여러분 집에도 잠자고 있는 거 하나쯤 있죠? 오늘 밤 한번 꺼내 봐요. 누군가의 백 퍼센트가 될지도 모르니까요.'),
  ('close', '내일은 미소 씨가 기다려요.'),
 ],
}
os.makedirs('out_voice', exist_ok=True)
LOG = open('out_voice/log.txt', 'w')
def say(*a): print(*a); LOG.write(' '.join(map(str, a)) + '\n'); LOG.flush()
def tts(model, voice, text):
    body = {'contents': [{'parts': [{'text': text}]}],
            'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}',
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r: d = json.load(r)
    return base64.b64decode(d['candidates'][0]['content']['parts'][0]['inlineData']['data'])
for who, segs in SEG.items():
    for n, (kind, line) in enumerate(segs):
        if ONLY and f'{who}_{n}' not in ONLY: continue
        time.sleep(7)
        prompt = '[아래 설정과 연출은 소리 내어 읽지 말 것]\n' + PROFILE[who] + '\n' + STYLE[kind] + '\n\n[읽을 대본 — 이 부분만 읽기]\n' + line
        done = False
        for m in MODELS:
            for attempt in range(4):
                try: pcm = tts(m, VOICE[who], prompt)
                except Exception as e:
                    det = e.read().decode()[:200] if hasattr(e, 'read') else ''
                    say('실패', who, n, m, attempt, str(e)[:120], det); time.sleep(20); continue
                sec = len(pcm) / 48000
                if sec > len(line) * 0.35 + 3: say('지시문까지 읽음?', who, n, round(sec, 1)); continue
                with wave.open(f'out_voice/{who}_{n}.wav', 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
                say('완료', who, n, m, round(sec, 1)); done = True; break
            if done: break
