const pictures = [
  { name: 'あめあがりの ねこ', file: 'assets/kitten-rainy-day.png', category: 'どうぶつ' },
  { name: 'にじの パンダ', file: 'assets/panda-meadow.png', category: 'どうぶつ' },
  { name: 'うちゅうの ペンギン', file: 'assets/penguin-space.png', category: 'うちゅう' },
  { name: 'まちの しょうぼうしゃ', file: 'assets/firetruck-village.png', category: 'のりもの' },
  { name: 'いちごの ケーキ', file: 'assets/strawberry-cake.png', category: 'たべもの' },
  { name: 'うみの かめ', file: 'assets/sea-turtle-ocean.png', category: 'しぜん' }
];
const difficultyConfig = { easy: { min: 3, max: 5 }, normal: { min: 7, max: 10 }, hard: { min: 12, max: 18 } };
const praises = ['えあわせ名人！', 'すてき！だいせいこう！', 'キラキラ 100てん！', 'やったね！すごい！'];
const solvedState = '012345678';
let level = 'easy', pictureIndex = 0, tiles = [], blank = 8, moves = 0;
let completed = Number(localStorage.getItem('puzzleStars') || 0), soundOn = true, voiceOn = false;
let puzzlePools = {}, nextStateMap = new Map(), progress = loadProgress();
const puzzle = document.querySelector('#puzzle'), message = document.querySelector('#message'), stars = document.querySelector('#stars'), moveCount = document.querySelector('#moveCount'), sparkles = document.querySelector('#sparkles'), picturePicker = document.querySelector('#picturePicker'), guide = document.querySelector('#guide'), newPicture = document.querySelector('#newPicture');

function neighbors(index) { const adjacent = []; if (index > 2) adjacent.push(index - 3); if (index < 6) adjacent.push(index + 3); if (index % 3) adjacent.push(index - 1); if (index % 3 < 2) adjacent.push(index + 1); return adjacent; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function buildPuzzlePools() {
  const maxDepth = Math.max(...Object.values(difficultyConfig).map(config => config.max));
  puzzlePools = Array.from({ length: maxDepth + 1 }, () => []);
  const queue = [{ state: solvedState, blank: 8, depth: 0 }];
  const visited = new Set([solvedState]);
  nextStateMap = new Map([[solvedState, null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    puzzlePools[current.depth].push(current.state);
    if (current.depth === maxDepth) continue;
    neighbors(current.blank).forEach(target => {
      const characters = current.state.split('');
      [characters[current.blank], characters[target]] = [characters[target], characters[current.blank]];
      const nextState = characters.join('');
      if (visited.has(nextState)) return;
      visited.add(nextState);
      nextStateMap.set(nextState, current.state);
      queue.push({ state: nextState, blank: target, depth: current.depth + 1 });
    });
  }
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem('puzzleProgressV1') || '{}');
    if (saved.version === 1 && saved.puzzles) return saved;
  } catch (_) { /* 壊れた保存データは初期状態へ戻す */ }
  return { version: 1, puzzles: {} };
}
function progressKey() { return `${pictureIndex}-${level}`; }
function currentProgress() { return progress.puzzles[progressKey()] || { completed: 0, bestMoves: null }; }
function saveProgress() { localStorage.setItem('puzzleProgressV1', JSON.stringify(progress)); }
function unlockedPictureCount() { return Math.min(pictures.length, 3 + Math.floor(completed / 3)); }

function setup() {
  const config = difficultyConfig[level];
  const targetDepth = randomInt(config.min, config.max);
  const options = puzzlePools[targetDepth];
  const state = options[randomInt(0, options.length - 1)];
  tiles = state.split('').map(Number);
  blank = tiles.indexOf(8);
  moves = 0;
  document.querySelector('.game-card').classList.remove('complete');
  document.querySelector('#finishedActions').hidden = true;
  render();
  message.textContent = 'あいている ばしょの となりを おしてね';
  updateGuideTarget();
}

function renderPicturePicker() {
  picturePicker.innerHTML = '';
  const unlocked = unlockedPictureCount();
  pictures.forEach((picture, index) => {
    const isUnlocked = index < unlocked;
    const button = document.createElement('button');
    button.className = `picture-choice ${index === pictureIndex ? 'selected' : ''} ${isUnlocked ? '' : 'locked'}`;
    button.type = 'button';
    button.disabled = !isUnlocked;
    button.setAttribute('aria-pressed', index === pictureIndex);
    button.setAttribute('aria-label', isUnlocked ? `${picture.name}${index === pictureIndex ? '（えらんでいる）' : ''}` : `${picture.name}（あと${Math.max(1, 3 - completed)}かいで あそべるよ）`);
    button.innerHTML = `<img src="${picture.file}" alt=""><span>${picture.name}</span>${isUnlocked ? '' : '<b class="lock-mark">🔒</b>'}`;
    if (isUnlocked) button.addEventListener('click', () => { if (index === pictureIndex) return; pictureIndex = index; setup(); speak(`${picture.name}だよ`); });
    picturePicker.append(button);
  });
}

function render() {
  const picture = pictures[pictureIndex];
  document.querySelector('#pictureName').textContent = picture.name;
  document.querySelector('#referenceImage').src = picture.file;
  document.querySelector('#referenceImage').alt = `${picture.name} 完成見本`;
  document.querySelector('#largeReferenceImage').src = picture.file;
  document.querySelector('#largeReferenceImage').alt = `${picture.name} 完成見本`;
  document.querySelector('#largeReferenceName').textContent = picture.name;
  stars.textContent = completed;
  moveCount.textContent = moves;
  document.querySelector('#bestMoves').textContent = currentProgress().bestMoves === null ? 'ベスト —' : `ベスト ${currentProgress().bestMoves}かい`;
  renderPicturePicker();
  puzzle.innerHTML = '';
  tiles.forEach((piece, index) => {
    const tile = document.createElement('button');
    tile.className = `tile ${piece === 8 ? 'blank' : ''}`;
    tile.type = 'button';
    tile.setAttribute('aria-label', piece === 8 ? 'あいている ばしょ' : `えの ピース ${piece + 1}`);
    tile.setAttribute('aria-rowindex', Math.floor(index / 3) + 1);
    if (piece !== 8) {
      const row = Math.floor(piece / 3), column = piece % 3;
      tile.style.backgroundImage = `url("${picture.file}")`;
      tile.style.backgroundPosition = `${column * 50}% ${row * 50}%`;
    } else { tile.setAttribute('aria-hidden', 'true'); tile.tabIndex = -1; }
    tile.addEventListener('click', () => move(index));
    puzzle.append(tile);
  });
}

function getHintTarget() {
  const nextState = nextStateMap.get(tiles.join(''));
  return nextState ? nextState.indexOf('8') : null;
}
function updateGuideTarget() {
  document.querySelectorAll('.tile.guide-target').forEach(tile => tile.classList.remove('guide-target'));
  const target = getHintTarget();
  if (!guide.hidden && target !== null && puzzle.children[target]) puzzle.children[target].classList.add('guide-target');
}
function showFirstGuide() { if (localStorage.getItem('puzzleOnboardingV1') !== 'done') { guide.hidden = false; updateGuideTarget(); } }
function closeGuide(markComplete = false) { guide.hidden = true; document.querySelectorAll('.tile.guide-target').forEach(tile => tile.classList.remove('guide-target')); if (markComplete) localStorage.setItem('puzzleOnboardingV1', 'done'); }

function move(index) {
  if (!neighbors(blank).includes(index)) { message.textContent = 'あいている ばしょの となりを おしてね'; return; }
  if (soundOn) beep(380);
  [tiles[blank], tiles[index]] = [tiles[index], tiles[blank]];
  blank = index; moves += 1; closeGuide(true); render();
  if (tiles.every((piece, position) => piece === position)) win(); else updateGuideTarget();
}
function hint() {
  const target = getHintTarget();
  if (target === null || !puzzle.children[target]) return;
  puzzle.children[target].classList.add('hinting'); message.textContent = 'ここを おしてみよう！';
  if (soundOn) beep(620); speak('ここを おしてみよう');
  window.setTimeout(() => puzzle.children[target]?.classList.remove('hinting'), 1300);
}
function win() {
  const key = progressKey(), record = currentProgress();
  record.completed += 1; record.bestMoves = record.bestMoves === null ? moves : Math.min(record.bestMoves, moves);
  progress.puzzles[key] = record; saveProgress(); completed += 1; localStorage.setItem('puzzleStars', completed);
  stars.textContent = completed; renderPicturePicker(); document.querySelector('#bestMoves').textContent = `ベスト ${record.bestMoves}かい`; document.querySelector('.game-card').classList.add('complete'); document.querySelector('#finishedActions').hidden = false;
  document.querySelector('#collectionMessage').textContent = completed % 3 === 0 ? 'あたらしい えが あそべるよ！' : praises[Math.floor(Math.random() * praises.length)];
  message.textContent = `${praises[Math.floor(Math.random() * praises.length)]} ${moves}かいで できたよ！`;
  if (soundOn) { beep(520); window.setTimeout(() => beep(720), 130); } speak('すごい、できたね');
  for (let index = 0; index < 22; index += 1) { const sparkle = document.createElement('span'); sparkle.className = 'confetti'; sparkle.textContent = ['⭐', '🌸', '✨', '💖'][index % 4]; sparkle.style.left = '50%'; sparkle.style.top = '50%'; sparkle.style.setProperty('--x', `${(Math.random() - 0.5) * 420}px`); sparkle.style.setProperty('--y', `${(Math.random() - 0.5) * 360}px`); sparkles.append(sparkle); window.setTimeout(() => sparkle.remove(), 1100); }
}
function beep(frequency) { try { const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.value = 0.04; oscillator.connect(gain).connect(context.destination); oscillator.start(); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.11); oscillator.stop(context.currentTime + 0.12); } catch (_) { /* 音が使えない環境でもゲームは続ける */ } }
function speak(text) { if (!voiceOn || !('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.rate = 0.9; window.speechSynthesis.speak(utterance); }
function openModal(id) { document.querySelector(`#${id}`).hidden = false; document.querySelector(`#${id} .modal-close`)?.focus(); }
function closeModal(id) { document.querySelector(`#${id}`).hidden = true; }
function nextUnlockedPicture() { const unlocked = unlockedPictureCount(); pictureIndex = (pictureIndex + 1) % unlocked; setup(); }

document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => { level = button.dataset.level; document.querySelectorAll('[data-level]').forEach(item => item.classList.toggle('selected', item === button)); setup(); speak(`${button.textContent.split('\n')[0]}だよ`); }));
newPicture.addEventListener('click', nextUnlockedPicture);
document.querySelector('#restartButton').addEventListener('click', setup);
document.querySelector('#playAgainButton').addEventListener('click', setup);
document.querySelector('#nextPictureButton').addEventListener('click', nextUnlockedPicture);
document.querySelector('#hintButton').addEventListener('click', hint);
document.querySelector('#guideClose').addEventListener('click', () => closeGuide(true));
document.querySelector('#referenceButton').addEventListener('click', () => openModal('referenceModal'));
document.querySelector('#howToButton').addEventListener('click', () => openModal('howToModal'));
document.querySelector('#howToStartButton').addEventListener('click', () => { closeModal('howToModal'); guide.hidden = false; updateGuideTarget(); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal.id); }));
document.querySelector('#soundButton').addEventListener('click', event => { soundOn = !soundOn; event.currentTarget.textContent = soundOn ? '♪' : '×'; event.currentTarget.setAttribute('aria-pressed', soundOn); event.currentTarget.setAttribute('aria-label', soundOn ? '効果音をオフにする' : '効果音をオンにする'); });
document.querySelector('#voiceButton').addEventListener('click', event => { voiceOn = !voiceOn; event.currentTarget.classList.toggle('active', voiceOn); event.currentTarget.setAttribute('aria-pressed', voiceOn); event.currentTarget.setAttribute('aria-label', voiceOn ? '声の案内をオフにする' : '声の案内をオンにする'); if (voiceOn) speak('声の案内をオンにしたよ'); });

buildPuzzlePools();
stars.textContent = completed;
setup();
showFirstGuide();
