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
STYLE = ('[연출] 아침 라디오 오프닝처럼 옆 사람에게 재미있는 얘기를 들려주듯 자연스럽게. 낭독하듯 딱딱하지 않게. '
         '질문 끝은 살짝 올리고, 반전 앞에서는 반 박자 쉬기.')
SCRIPT = {
 'miso': '포스트잇, 원래는 실패작이었다는 거 아세요? 아주 센 풀을 만들려다, 붙었다 떨어지는 약한 풀이 나왔대요. 다들 쓸모없다고 했죠. 그런데 몇 년 뒤, 악보 책갈피가 자꾸 빠져서 그 풀을 발라 본 동료가 있었어요. 실패도 제자리를 만나면 히트작이 되네요. 내일은요, 한결 씨가 김치찌개에 설탕을 넣는 사연을 털어놓는대요.',
 'hangyeol': '어제 미소 씨가 제 비밀을 먼저 말해 버렸네요. 네, 김치찌개에 설탕 넣습니다. 신 김치엔 한 꼬집이면 맛이 둥글어져요. 장모님께 배운 건데요… 아내는 아직 몰라요. 여보, 오늘 처음 듣는 거죠? 내일은 미소 씨가 테니스 코치한테 들은, 좀 서운한 한마디를 들려준대요.',
}
VOICES = {'miso': ['Gacrux', 'Vindemiatrix', 'Kore', 'Despina', 'Erinome', 'Callirrhoe'], 'hangyeol': ['Sadaltager', 'Schedar', 'Rasalgethi', 'Orus', 'Iapetus', 'Algenib', 'Algieba', 'Charon']}
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
