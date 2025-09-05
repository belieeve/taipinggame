document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const resultScreen = document.getElementById('result-screen');
    const scoreDisplay = document.getElementById('score');
    const finalScoreDisplay = document.getElementById('final-score');
    const gameArea = document.getElementById('game-area');
    const judgmentLine = document.getElementById('judgment-line');
    const keyD = document.getElementById('key-d');
    const keyF = document.getElementById('key-f');
    const keyJ = document.getElementById('key-j');

    // --- ボタン要素の取得 ---
    const levelButtons = [
        document.getElementById('level-easy'),
        document.getElementById('level-normal'),
        document.getElementById('level-hard')
    ];
    const retryButton = document.getElementById('retry-button');

    // --- ゲーム設定 ---
    let score = 0;
    let notes = [];
    let audio;
    let musicData;
    let startTime;
    let gameInterval;
    const keyMapping = { 'd': 0, 'f': 1, 'j': 2 };
    const keyElements = { 'd': keyD, 'f': keyF, 'j': keyJ };

    // --- 譜面データ生成 ---
    function createSheet(bpm, lengthSeconds, pattern) {
        const sheet = [];
        const interval = 60000 / bpm;
        const totalNotes = Math.floor(lengthSeconds * 1000 / interval);
        for (let i = 0; i < totalNotes; i++) {
            const lane = pattern[i % pattern.length];
            if (lane !== null) {
                 sheet.push({ time: Math.floor((i + 1) * interval), lane: lane });
            }
        }
        return sheet;
    }

    const musicSheets = {
        'level-easy': { audioSrc: 'assets/audio/song-easy.mp3', data: createSheet(120, 300, [0, 1, 2, 1]) },
        'level-normal': { audioSrc: 'assets/audio/song-normal.mp3', data: createSheet(135, 300, [0, 2, 1, 0, 1, 2, 0, null]) },
        'level-hard': { audioSrc: 'assets/audio/song-hard.mp3', data: createSheet(150 * 2, 300, [0, null, 1, null, 2, null, 1, null, 0, 1, 2, null, 0, null, 1, 2]) }
    };

    // --- イベントリスナー ---
    levelButtons.forEach(button => button.addEventListener('click', () => startGame(button.id)));
    retryButton.addEventListener('click', () => {
        resultScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
    });
    document.addEventListener('keydown', handleKeyPress);

    // --- ゲーム開始処理 ---
    function startGame(level) {
        musicData = JSON.parse(JSON.stringify(musicSheets[level]));
        startScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        score = 0;
        notes = [];
        updateScore(0);
        while (gameArea.firstChild) {
            gameArea.removeChild(gameArea.firstChild);
        }
        gameArea.appendChild(judgmentLine);

        if (audio) audio.pause();
        audio = new Audio(musicData.audioSrc);
        audio.play().catch(e => console.error("音楽の再生に失敗しました:", e));

        startTime = Date.now();
        gameLoop();
        audio.addEventListener('ended', showResult);
    }

    // --- ゲームループ ---
    function gameLoop() {
        const currentTime = Date.now() - startTime;
        while (musicData.data.length > 0 && musicData.data[0].time <= currentTime) {
            createNote(musicData.data.shift().lane);
        }

        const notesToRemove = [];
        notes.forEach(note => {
            const newTop = parseFloat(note.style.top) + 3;
            note.style.top = `${newTop}px`;
            if (newTop > gameArea.clientHeight) {
                notesToRemove.push(note);
                showJudgmentEffect('Miss');
            }
        });
        notesToRemove.forEach(note => removeNote(note));
        gameInterval = requestAnimationFrame(gameLoop);
    }

    // --- ノーツ生成 ---
    function createNote(lane) {
        const note = document.createElement('div');
        note.classList.add('note');
        note.dataset.lane = lane;
        note.style.top = '0px';
        note.style.left = `${(lane * 33.3) + 16.65}%`;
        gameArea.insertBefore(note, judgmentLine);
        notes.push(note);
    }
    
    // --- キー入力処理 ---
    function handleKeyPress(e) {
        if (!keyMapping.hasOwnProperty(e.key)) return;
        
        const keyElement = keyElements[e.key];
        if (keyElement) {
            keyElement.classList.add('active');
            setTimeout(() => keyElement.classList.remove('active'), 100);
        }

        const lane = keyMapping[e.key];
        const targetNotes = notes.filter(note => parseInt(note.dataset.lane) === lane);
        if (targetNotes.length === 0) return;

        const judgmentLinePosition = judgmentLine.offsetTop;
        const closestNote = targetNotes.reduce((closest, current) => {
            const closestDist = Math.abs(parseFloat(closest.style.top) - judgmentLinePosition);
            const currentDist = Math.abs(parseFloat(current.style.top) - judgmentLinePosition);
            return currentDist < closestDist ? current : closest;
        });
        judge(closestNote);
    }

    // --- 判定処理 ---
    function judge(note) {
        const judgmentLinePosition = judgmentLine.offsetTop;
        const notePosition = parseFloat(note.style.top) + (note.clientHeight / 2);
        const distance = Math.abs(notePosition - judgmentLinePosition);

        let judgment = 'Miss';
        if (distance < 30) { // Perfect
            judgment = 'Perfect';
            updateScore(300);
        } else if (distance < 60) { // Good
            judgment = 'Good';
            updateScore(100);
        }

        showJudgmentEffect(judgment);
        if (judgment !== 'Miss') {
            removeNote(note);
        }
    }
    
    // --- スコア更新 ---
    function updateScore(point) {
        score += point;
        scoreDisplay.textContent = `スコア: ${score}`;
    }

    // --- ノーツ削除 ---
    function removeNote(note) {
        if (note.parentNode === gameArea) {
            gameArea.removeChild(note);
        }
        notes = notes.filter(n => n !== note);
    }

    // --- 判定エフェクト表示 ---
    function showJudgmentEffect(text) {
        const effect = document.createElement('div');
        effect.classList.add('judgment-effect');
        effect.textContent = text;
        // 判定ラインより上にエフェクトを表示
        effect.style.top = (judgmentLine.offsetTop - 40) + 'px';
        gameArea.appendChild(effect);
        setTimeout(() => {
            if (effect.parentNode === gameArea) {
                gameArea.removeChild(effect);
            }
        }, 500);
    }

    // --- 結果表示 ---
    function showResult() {
        cancelAnimationFrame(gameInterval);
        if(audio) audio.pause();
        gameScreen.classList.add('hidden');
        resultScreen.classList.remove('hidden');
        finalScoreDisplay.textContent = `さいしゅうスコア: ${score}`;
    }
});
