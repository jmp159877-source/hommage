// 1 to 50 — 5×5 판의 숫자를 1부터 차례로 누른다. 누르면 그 자리에 26~50이 나타남.
import * as P from '../play.js';
export function mount(el) {
  const T = P.shell(el, 'num50');
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let next, grid, back, wrong;
  function ready() {
    T.reset(); next = 1; wrong = 0; grid = shuffle([...Array(25)].map((_, i) => i + 1)); back = shuffle([...Array(25)].map((_, i) => i + 26));
    T.body.innerHTML = `<p class="n5-goal">다음 숫자 <b id="n5-next">1</b></p><div class="n5-grid" id="n5-grid">${grid.map((n, i) => `<button type="button" class="n5" data-i="${i}">${n}</button>`).join('')}</div><p class="note" style="text-align:center;margin-top:14px">5초 뒤 시작합니다. 틀리게 누르면 1초가 더해져요.</p>`;
    T.body.querySelector('#n5-grid').onclick = e => {
      const b = e.target.closest('.n5'); if (!b || b.classList.contains('gone')) return;
      const i = +b.dataset.i;
      if (grid[i] !== next) { wrong++; T.add(1000); P.sfx('bad'); b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 250); return; }
      P.sfx('tap');
      if (next <= 25) { grid[i] = back.pop(); b.textContent = grid[i]; b.classList.add('two'); } else { b.classList.add('gone'); b.textContent = ''; }
      next++; const nx = T.body.querySelector('#n5-next'); if (nx) nx.textContent = next <= 50 ? next : '끝!';
      if (next > 50) {
        const ms = T.stop(); P.sfx('win'); T.body.querySelector('#n5-grid').style.display = 'none'; T.body.querySelector('.n5-goal').style.display = 'none';
        P.finish('num50', ms, P.fmtKo(ms) + (wrong ? ` (실수 ${wrong})` : ''), T.body);
        const again = document.createElement('button'); again.type = 'button'; again.className = 'btn line pl-again'; again.textContent = '한 판 더'; again.onclick = () => ready();
        T.body.appendChild(again);
      }
    };
    T.countdown(null, 0, T.body.querySelector('#n5-grid'));
  }
  ready();
}
