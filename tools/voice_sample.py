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
 'story': '[연출] 친한 친구에게 "이거 들어 봐" 하고 이야기 들려주듯 가깝고 생기 있게. 자연스러운 대화 빠르기, 늘어지지 않게.',
 'close': '[연출] 듣는 사람에게 힘을 주는 마무리. 밝고 힘 있게, 말 걸듯이.',
}
VOICE = {'miso': 'Gacrux', 'hangyeol': 'Schedar'}
SEG = {
 'miso': [('greet', '좋은 아침! 미소예요.'),
          ('greet', '금요일이에요, 벌써 반은 이긴 거예요. 오늘은 어깨 한 번 쫙 펴고 시작해요!'),
          ('story', '오늘 사연 하나 들려 드릴게요.'),
          ('story', '쉰둘에 차린 동네 빵집, 개업 첫날 손님이… 영 명이었대요.'),
          ('story', '그런데 삼 주 뒤, 리뷰 한 줄에 가게 앞에 줄이 섰답니다!'),
          ('close', '그러니까 오늘, 우리도 일단 문 열어요!'),
          ('close', '내일은 한결 씨랑 만나요.')],
 'hangyeol': [('greet', '오늘도 수고 많으셨어요, 한결입니다.'),
          ('greet', '토요일 저녁이에요. 오늘은 나한테 좋은 거 하나 해 주기로 해요.'),
          ('story', '오늘 사연 하나 갈게요.'),
          ('story', '딸한테 엄마는 무리야, 소리 들은 엄마가요,'),
          ('story', '그날 밤 새로고침만 세 시간, 딸보다 스무 줄 앞자리를 잡았대요!'),
          ('close', '해 보기 전엔 아무도 몰라요. 오늘 밤엔 미뤄 둔 거 하나, 딱 눌러 봐요!'),
          ('close', '내일은 미소 씨가 기다려요.')],
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
