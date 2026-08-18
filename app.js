const pictures = [
  { name: 'あめあがりの ねこ', file: 'assets/kitten-rainy-day.png', category: 'どうぶつ' },
  { name: 'にじの パンダ', file: 'assets/panda-meadow.png', category: 'どうぶつ' },
  { name: 'うちゅうの ペンギン', file: 'assets/penguin-space.png', category: 'うちゅう' },
  { name: 'まちの しょうぼうしゃ', file: 'assets/firetruck-village.png', category: 'のりもの' },
  { name: 'いちごの ケーキ', file: 'assets/strawberry-cake.png', category: 'たべもの' },
  { name: 'うみの かめ', file: 'assets/sea-turtle-ocean.png', category: 'しぜん' }
];
const difficultyConfig = { easy: { grid: 2, min: 3, max: 5 }, normal: { grid: 3, min: 7, max: 10 }, hard: { grid: 4, min: 18, max: 26 } };
const praises = ['えあわせ名人！', 'すてき！だいせいこう！', 'キラキラ 100てん！', 'やったね！すごい！'];
let level = 'easy', pictureIndex = 0, tiles = [], blank = 8, moves = 0;
let completed = Number(localStorage.getItem('puzzleStars') || 0), soundOn = true, voiceOn = false;
let puzzlePools = {}, nextStateMaps = {}, progress = loadProgress();
const puzzle = document.querySelector('#puzzle'), message = document.querySelector('#message'), stars = document.querySelector('#stars'), moveCount = document.querySelector('#moveCount'), sparkles = document.querySelector('#sparkles'), picturePicker = document.querySelector('#picturePicker'), guide = document.querySelector('#guide'), newPicture = document.querySelector('#newPicture'), uploadPictureButton = document.querySelector('#uploadPictureButton'), pictureFileInput = document.querySelector('#pictureFileInput');
let customPictureIndex = null;

function gridSize() { return difficultyConfig[level].grid; }
function solvedState(size = gridSize()) { return Array.from({ length: size * size }, (_, index) => index).join(','); }
function decodeState(state) { return state.split(',').map(Number); }
function neighbors(index, size = gridSize()) { const adjacent = [], row = Math.floor(index / size), column = index % size; if (row > 0) adjacent.push(index - size); if (row < size - 1) adjacent.push(index + size); if (column > 0) adjacent.push(index - 1); if (column < size - 1) adjacent.push(index + 1); return adjacent; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function buildPuzzlePool(size, maxDepth) {
  const solved = solvedState(size), pool = Array.from({ length: maxDepth + 1 }, () => []), queue = [{ state: solved, blank: size * size - 1, depth: 0 }], visited = new Set([solved]);
  const stateMap = new Map([[solved, null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]; pool[current.depth].push(current.state);
    if (current.depth === maxDepth) continue;
    neighbors(current.blank, size).forEach(target => {
      const characters = decodeState(current.state); [characters[current.blank], characters[target]] = [characters[target], characters[current.blank]];
      const nextState = characters.join(','); if (visited.has(nextState)) return;
      visited.add(nextState); stateMap.set(nextState, current.state); queue.push({ state: nextState, blank: target, depth: current.depth + 1 });
    });
  }
  return { pool, stateMap };
}
function buildPuzzlePools() {
  puzzlePools = {}; nextStateMaps = {};
  [difficultyConfig.easy, difficultyConfig.normal].forEach(config => { const result = buildPuzzlePool(config.grid, config.max); puzzlePools[config.grid] = result.pool; nextStateMaps[config.grid] = result.stateMap; });
}
function shuffleHard(size, count) {
  const state = decodeState(solvedState(size)); let empty = state.length - 1, previous = -1;
  for (let turn = 0; turn < count; turn += 1) {
    const choices = neighbors(empty, size).filter(index => index !== previous); const target = choices[randomInt(0, choices.length - 1)];
    [state[empty], state[target]] = [state[target], state[empty]]; previous = empty; empty = target;
  }
  return state.join(',');
}

/* 2x2/3x3 は最短手数別プール、4x4 は合法シャッフルで生成する。 */
function createPuzzleState() {
  const config = difficultyConfig[level];
  if (config.grid === 4) return shuffleHard(config.grid, randomInt(config.min, config.max));
  const options = puzzlePools[config.grid][randomInt(config.min, config.max)];
  return options[randomInt(0, options.length - 1)];
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
function unlockedPictureIndexes() { const count = Math.min(pictures.length, 3 + Math.floor(completed / 3)); return pictures.map((_, index) => index).filter(index => index < count || index === customPictureIndex); }

function setup() {
  const state = createPuzzleState();
  tiles = decodeState(state);
  blank = tiles.indexOf(tiles.length - 1);
  moves = 0;
  document.querySelector('.game-card').classList.remove('complete');
  document.querySelector('#finishedActions').hidden = true;
  render();
  message.textContent = 'あいている ばしょの となりを おしてね';
  updateGuideTarget();
}

function renderPicturePicker() {
  picturePicker.innerHTML = '';
  const unlocked = unlockedPictureIndexes();
  pictures.forEach((picture, index) => {
    const isUnlocked = unlocked.includes(index);
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

function render(isComplete = false) {
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
    const isBlank = piece === tiles.length - 1 && !isComplete;
    tile.className = `tile ${isBlank ? 'blank' : ''}`;
    tile.type = 'button';
    tile.setAttribute('aria-label', isBlank ? 'あいている ばしょ' : `えの ピース ${piece + 1}`);
    tile.setAttribute('aria-rowindex', Math.floor(index / gridSize()) + 1);
    if (!isBlank) {
      const row = Math.floor(piece / gridSize()), column = piece % gridSize(), position = gridSize() === 1 ? 0 : 100 / (gridSize() - 1);
      tile.style.backgroundImage = `url("${picture.file}")`;
      tile.style.backgroundSize = `${gridSize() * 100}% ${gridSize() * 100}%`;
      tile.style.backgroundPosition = `${column * position}% ${row * position}%`;
    } else { tile.setAttribute('aria-hidden', 'true'); tile.tabIndex = -1; }
    tile.addEventListener('click', () => move(index));
    puzzle.append(tile);
  });
  puzzle.style.setProperty('--grid-size', gridSize());
}

function getHintTarget() {
  const current = tiles.join(','), exactNext = nextStateMaps[gridSize()]?.get(current);
  if (exactNext) return decodeState(exactNext).indexOf(tiles.length - 1);
  if (tiles.every((piece, position) => piece === position)) return null;
  const size = gridSize(), candidates = neighbors(blank, size);
  return candidates.sort((a, b) => manhattanAfterMove(a) - manhattanAfterMove(b))[0] ?? null;
}
function manhattanAfterMove(target) {
  const copy = tiles.slice(); [copy[blank], copy[target]] = [copy[target], copy[blank]]; const size = gridSize();
  return copy.reduce((total, piece, index) => { if (piece === copy.length - 1) return total; return total + Math.abs(Math.floor(piece / size) - Math.floor(index / size)) + Math.abs(piece % size - index % size); }, 0);
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
  progress.puzzles[key] = record; saveProgress(); completed += 1; localStorage.setItem('puzzleStars', completed); render(true);
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
function nextUnlockedPicture() { const unlocked = unlockedPictureIndexes(); if (!unlocked.length) return; const current = unlocked.indexOf(pictureIndex); pictureIndex = unlocked[(current + 1) % unlocked.length]; setup(); }

function useUploadedPicture(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const sourceUrl = URL.createObjectURL(file), image = new Image();
  image.onload = () => {
    const size = 1200, canvas = document.createElement('canvas'), context = canvas.getContext('2d'), side = Math.min(image.naturalWidth, image.naturalHeight), left = (image.naturalWidth - side) / 2, top = (image.naturalHeight - side) / 2;
    canvas.width = size; canvas.height = size; context.drawImage(image, left, top, side, side, 0, 0, size, size);
    const picture = { name: 'あなたの しゃしん', file: canvas.toDataURL('image/jpeg', 0.9), category: 'オリジナル' };
    URL.revokeObjectURL(sourceUrl);
    if (customPictureIndex === null) { pictures.push(picture); customPictureIndex = pictures.length - 1; } else pictures[customPictureIndex] = picture;
    pictureIndex = customPictureIndex; setup(); message.textContent = 'しゃしんの パズルだよ！'; speak('しゃしんのパズルだよ');
  };
  image.onerror = () => { URL.revokeObjectURL(sourceUrl); message.textContent = 'その しゃしんは つかえないみたい'; };
  image.src = sourceUrl;
}

document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => { level = button.dataset.level; document.querySelectorAll('[data-level]').forEach(item => item.classList.toggle('selected', item === button)); setup(); speak(`${button.textContent.split('\n')[0]}だよ`); }));
newPicture.addEventListener('click', nextUnlockedPicture);
uploadPictureButton.addEventListener('click', () => pictureFileInput.click());
pictureFileInput.addEventListener('change', event => { useUploadedPicture(event.target.files[0]); event.target.value = ''; });
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

buildPuzzlePools();
stars.textContent = completed;
setup();
showFirstGuide();
