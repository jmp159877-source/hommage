# 오프닝 진행자 목소리 견본 만들기 (Gemini TTS) — 결과는 out_voice/*.wav
import os, json, base64, urllib.request, wave, subprocess, sys
KEY = os.environ['GEMINI_API_KEY']
MODELS = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts']
PROFILE = {
 'miso': '[목소리 설정] 45세 한국 여성 진행자. 세련되고 생기 있는 사람, 친구에게 썰 푸는 게 재미있는 타입. 맑고 탄력 있는 중음, 웃음이 잘 묻어남. 차분한 낭독조·나이 든 말투 금지.',
 'hangyeol': '[목소리 설정] 46세 한국 남성 진행자. 유쾌하고 센스 있는 사람, 친한 동료에게 웃긴 얘기 전하듯. 따뜻한 중저음이지만 무겁지 않고 경쾌함. 느린 설명조·아저씨 말투 금지.',
}
STYLE = ('[연출] 아침 라디오 DJ가 청취자 사연을 소개하듯, 친한 친구에게 "야 이거 들어 봐" 하고 썰 푸는 느낌. '
         '말 빠르기는 보통 낭독보다 확실히 빠르게, 경쾌한 템포로. 쉼은 짧게, 반전 앞에서만 아주 잠깐. '
         '웃긴 대목은 웃음을 섞고, 마지막은 듣는 사람에게 말 걸듯 밝게.')
SEG = {
 "miso": [
  "미소예요! 오늘 사연, 시작부터 쫄깃해요.",
  "쉰둘에 회사 그만두고 동네에 빵집을 차리셨대요. 개업 첫날 손님이… 영 명. 그날 빵을 전부 버렸대요.",
  "그런데 삼 주 뒤, 지나가던 손님이 남긴 리뷰 한 줄. 이 집 소금빵 때문에 이사 오고 싶다. 다음 날 아침, 가게 앞에 줄이 섰답니다.",
  "첫날 성적표가 끝은 아니네요. 내일은 한결 씨가 티켓팅 사연 들고 와요!"
 ],
 "hangyeol": [
  "한결입니다. 오늘 사연 듣고 저 커피 뿜었어요.",
  "딸이 콘서트 티켓팅을 맨 뒷자리로 겨우 성공하고 자랑하길래, 엄마도 해 보겠다 했더니… 엄마는 무리야, 하더래요.",
  "그날 밤, 엄마는 취소표 새로고침만 세 시간. 결국 잡으셨는데… 딸보다 스무 줄 앞자리였답니다.",
  "공연 날, 엄마가 뒤돌아서 손 흔들어 줬대요. 여러분도 오늘, 새로고침 한 번 더! 내일은 미소 씨가 첫사랑 사연 읽어 드려요."
 ]
}
SCRIPT = {k: ' '.join(v) for k, v in SEG.items()}
VOICES = {'miso': ['Gacrux'], 'hangyeol': ['Schedar']}
os.makedirs('out_voice', exist_ok=True)
LOG = open('out_voice/log.txt', 'w')
def say(*a): print(*a); LOG.write(' '.join(map(str, a)) + '\n'); LOG.flush()
def tts(model, voice, text, who):
    body = {'contents': [{'parts': [{'text': '[아래 설정과 연출은 소리 내어 읽지 말 것]\n' + PROFILE[who] + '\n' + STYLE + '\n\n[읽을 대본 — 이 부분만 읽기]\n' + text}]}],
            'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}',
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r: d = json.load(r)
    return base64.b64decode(d['candidates'][0]['content']['parts'][0]['inlineData']['data'])
ok = 0
for who, vs in VOICES.items():
    for v in vs:
        for m in MODELS:
            try: pcm = tts(m, v, SCRIPT[who], who)
            except Exception as e:
                det = e.read().decode()[:300] if hasattr(e, 'read') else ''
                say('실패', m, v, str(e)[:200], det); continue
            fn = f'out_voice/{who}_{v}'
            with wave.open(fn + '.wav', 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
            sec = round(len(pcm) / 48000, 1)
            if sec > 40: say('지시문까지 읽음', who, v, sec); continue
            say('완료', who, v, m, sec, '초'); ok += 1; break
say('합계', ok)
