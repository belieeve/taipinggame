document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const resultScreen = document.getElementById('result-screen');
    const scoreDisplay = document.getElementById('score');
    const finalScoreDisplay = document.getElementById('final-score');
    const gameArea = document.getElementById('game-area');
    const judgmentLine = document.getElementById('judgment-line');

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
    const judgmentLinePosition = gameArea.clientHeight - 50; // 判定ラインのY座標

    // --- 譜面データ生成 ---
    function createSheet(bpm, lengthSeconds, pattern) {
        const sheet = [];
        const interval = 60000 / bpm; // 1拍あたりのミリ秒
        const totalNotes = Math.floor(lengthSeconds * 1000 / interval);
        
        for (let i = 0; i < totalNotes; i++) {
            // patternに沿ってレーンを決める
            const lane = pattern[i % pattern.length];
            if (lane !== null) { // nullの場合はノーツを配置しない
                 sheet.push({ time: Math.floor((i + 1) * interval), lane: lane });
            }
        }
        return sheet;
    }

    const musicSheets = {
        'level-easy': {
            audioSrc: 'assets/audio/song-easy.mp3',
            // BPM 120, 60秒, シンプルなパターン
            data: createSheet(120, 60, [0, 1, 2, 1])
        },
        'level-normal': {
            audioSrc: 'assets/audio/song-normal.mp3',
            // BPM 135, 60秒, 少し複雑なパターン
            data: createSheet(135, 60, [0, 2, 1, 0, 1, 2, 0, null])
        },
        'level-hard': {
            audioSrc: 'assets/audio/song-hard.mp3',
            // BPM 150, 60秒, 8分音符も含むパターン (BPMを倍にしてnullで間引く)
            data: createSheet(150 * 2, 60, [0, null, 1, null, 2, null, 1, null, 0, 1, 2, null, 0, null, 1, 2])
        }
    };

    // --- イベントリスナー ---
    levelButtons.forEach(button => {
        button.addEventListener('click', () => startGame(button.id));
    });

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
        gameArea.innerHTML = '';

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
            const noteData = musicData.data.shift();
            createNote(noteData.lane);
        }

        const notesToRemove = [];
        notes.forEach(note => {
            const newTop = parseFloat(note.style.top) + 2; // 落下速度
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
        
        gameArea.appendChild(note);
        notes.push(note);
    }
    
    // --- キー入力処理 ---
    function handleKeyPress(e) {
        if (!keyMapping.hasOwnProperty(e.key)) return;

        const lane = keyMapping[e.key];
        const targetNotes = notes.filter(note => parseInt(note.dataset.lane) === lane);
        
        if (targetNotes.length === 0) return;

        // 判定ラインに一番近いノーツを探す
        const closestNote = targetNotes.reduce((closest, current) => {
            const closestDist = Math.abs(parseFloat(closest.style.top) - judgmentLinePosition);
            const currentDist = Math.abs(parseFloat(current.style.top) - judgmentLinePosition);
            return currentDist < closestDist ? current : closest;
        });

        judge(closestNote);
    }

    // --- 判定処理 ---
    function judge(note) {
        const notePosition = parseFloat(note.style.top) + (note.clientHeight / 2);
        const distance = Math.abs(notePosition - judgmentLinePosition);

        let judgment = 'Miss';
        if (distance < 20) {
            judgment = 'Perfect';
            updateScore(300);
        } else if (distance < 40) {
            judgment = 'Great';
            updateScore(200);
        } else if (distance < 60) {
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
        gameArea.removeChild(note);
        notes = notes.filter(n => n !== note);
    }

    // --- 判定エフェクト表示 ---
    function showJudgmentEffect(text) {
        const effect = document.createElement('div');
        effect.classList.add('judgment-effect');
        effect.textContent = text;
        gameArea.appendChild(effect);

        // アニメーションが終わったら要素を削除
        setTimeout(() => {
            gameArea.removeChild(effect);
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
