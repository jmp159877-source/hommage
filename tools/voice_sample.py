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
STYLE = ('[연출] 아침 라디오 DJ가 청취자 사연을 소개하듯. 친한 친구에게 재미난 얘기 전하듯 가깝고 생기 있게. '
         '말 빠르기는 보통 낭독보다 확실히 빠르게, 아침 방송처럼 경쾌한 템포로. 쉼은 짧게, 반전 앞에서만 아주 잠깐. '
         '웃긴 대목에선 웃음기를 섞고, 마지막 질문은 듣는 사람에게 말 걸듯.')
SEG = {
 "miso": [
  "좋은 아침이에요, 미소예요! 오늘 사연 듣고 저 아침부터 웃었어요.",
  "남편분이 요즘 갑자기 운동을 시작했대요. 새벽마다 나가서 두 시간씩요. 기특해서 하루는 몰래 따라가 봤대요.",
  "그랬더니… 공원 벤치에 앉아서 주식 앱만 보고 있더래요. 왜 그러냐 물었더니, 집에서 보면 당신이 한숨 쉬잖아.",
  "여러분, 오늘 계좌는 안녕하세요? 내일은 한결 씨가 동창회 단톡방 사연 들고 와요."
 ],
 "hangyeol": [
  "안녕하세요, 한결입니다. 주말 아침, 커피 한 잔 하셨어요?",
  "오늘 사연은 결혼 서른 해 된 남편분 이야기예요. 아내 휴대폰에 자기가 아직도 김 부장으로 저장돼 있더래요. 퇴직한 지 삼 년인데요.",
  "서운해서 몰래 바꾸려고 열어 봤더니… 그 밑에 한 줄이 더 있더랍니다. 아직도 내 편.",
  "여러분 휴대폰엔 그 사람, 뭐라고 저장돼 있어요? 내일은 미소 씨가 첫사랑 동창 사연 읽어 드려요."
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
