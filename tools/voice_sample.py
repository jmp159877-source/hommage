# 오프닝 진행자 목소리 견본 만들기 (Gemini TTS) — 결과는 out_voice/*.wav
import os, json, base64, urllib.request, wave, subprocess, sys
KEY = os.environ['GEMINI_API_KEY']
MODELS = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts']
PROFILE = {
 'miso': ('[목소리 설정] 48세 한국 여성 진행자. 크림색 재킷이 어울리는 단정하고 품위 있는 사람. 오래 방송을 해 온 여유. '
          '목소리는 맑지만 가볍지 않은 중음, 들뜨지 않고 안정적이며 말끝이 부드럽게 내려앉는다. 웃음기가 살짝 배어 있다. 아이 같거나 애교 섞인 톤은 절대 아님.'),
 'hangyeol': ('[목소리 설정] 52세 한국 남성 진행자. 짙은 회색 재킷에 흰 셔츠, 믿음직하고 다정한 사람. '
          '낮고 따뜻한 중저음, 서두르지 않는 말투, 농담할 때 눈가가 웃는 느낌. 젊은 청년 톤이나 광고 성우처럼 과장된 톤은 절대 아님.'),
}
STYLE = ('[연출] 아침 라디오에서 청취자 사연을 읽어 주듯. 오랜 친구에게, 혹은 아끼는 사람에게 말하듯 다정하고 가깝게. 인사는 가볍고 밝게, 사연은 귀 기울이게 천천히, 반전에서는 웃음을 참듯이, 마지막은 따뜻하게. 낭독하듯 딱딱하지 않게. '
         '질문 끝은 살짝 올리고, 반전 앞에서는 반 박자 쉬기.')
SEG = {
 "miso": [
  "좋은 아침이에요, 미소예요. 오늘 아침 공기, 코끝이 살짝 차갑죠?",
  "오늘 사연은 결혼 스물여섯 해 된 아내분 이야기예요. 요즘 남편이 퇴근하면, 말없이 베란다에 나가 한참을 서 있더래요.",
  "무슨 걱정이 있나 싶어 살짝 따라 나가 봤더니… 화분에 대고, 잘 자라라, 잘 자라라, 하고 있더랍니다.",
  "스물여섯 해 만에 처음 본, 남편의 다정한 얼굴이래요. 내일은 한결 씨가 첫 월급 사연을 들고 온대요."
 ],
 "hangyeol": [
  "안녕하세요, 한결입니다. 토요일 아침이네요. 이번 주도 애쓰셨어요.",
  "오늘은 첫 월급 사연이에요. 서른다섯 해 전, 첫 월급으로 어머니께 빨간 내복을 사 드렸대요.",
  "그런데 얼마 전, 어머니 댁 장롱 정리를 돕다가… 그 내복이 포장도 안 뜯긴 채 나왔답니다. 아까워서 못 입으셨대요.",
  "올겨울엔 새 내복 사 들고 가신대요. 이번엔 꼭 입으시라고요. 내일은 미소 씨가 동창회 사연을 읽어 드린대요."
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
