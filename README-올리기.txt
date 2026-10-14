오마주 사이트 묶음 (2026-10-14)

[깃허브에 올리기]
이 폴더 안의 모든 파일과 폴더를 저장소에 올립니다.
 - index.html, admin.html, terms.html, privacy.html
 - manifest.webmanifest, sw.js, firebase-config.js, firestore.rules
 - css/, js/, img/
 - logo.png, logo-light.png, leaf.png, og.jpg, icon-192.png, icon-512.png
기존 index.html, logo-light.png, leaf.png는 새것으로 바뀝니다. 예전 .jfif 사진은 지워도 됩니다.

[파이어베이스에서 할 것 두 가지]
1. 보안 규칙 넣기: Firestore Database → "규칙" 탭 → 내용을 전부 지우고 firestore.rules 파일 내용을 붙여 넣기 → "게시"
2. 관리자 지정: 사이트에서 사장님 계정을 먼저 가입한 뒤,
   Firestore Database → "데이터" 탭 → users → 사장님 문서(아이디가 보임) → role 값을 member에서 admin으로 바꾸고 저장.
   그 뒤 omaju.kr/admin.html 에서 그 아이디로 로그인하면 관리자 화면이 열립니다.
