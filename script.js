document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const resultScreen = document.getElementById('result-screen');
    const scoreDisplay = document.getElementById('score');
    const finalScoreDisplay = document.getElementById('final-score');
    const gameArea = document.getElementById('game-area');
    const judgmentLine = document.getElementById('judgment-line');
    const keyA = document.getElementById('key-a');
    const keySpace = document.getElementById('key-space');
    const keyEnter = document.getElementById('key-enter');
    const hpBar = document.getElementById('hp-bar');

    // --- ボタン要素の取得 ---
    const levelButtons = [
        document.getElementById('level-easy'),
        document.getElementById('level-normal'),
        document.getElementById('level-hard')
    ];
    const retryButton = document.getElementById('retry-button');
    const giveUpButton = document.getElementById('give-up-button');

    // --- ゲーム設定 ---
    let score = 0;
    let hp = 0;
    let notes = [];
    let audio;
    let musicData;
    let startTime;
    let gameInterval;
    let noteSpeed = 3;
    let laneCount = 1;
    let activeKeys = [];
    let keyMapping = {};
    let keyElements = {};
    const lanePositions = ['25%', '50%', '75%']; // 3レーン分の位置

    // --- 新しい譜面データ生成 ---
    function generateMusicSheet(bpm, totalMeasures, level, laneCount) {
        const sheet = [];
        const measureDuration = 60000 / bpm * 4; // 1小節のミリ秒

        // レベルに応じたリズムパターン
        const patterns = {
            easy: [
                [0, null, null, null], // 4分
                [0, null, 0, null],   // 4分x2
            ],
            normal: [
                [0, null, 0, null],   // 4分x2
                [0, 0, null, null],   // 8分
                [0, 0, 0, null],   // 8分+4分
                [0, null, 0, 0],   // 4分+8分
            ],
            hard: [
                [0, 0, 0, 0],       // 8分x2
                [0, 0, 0, null],   // 8分+4分
                [0, null, 0, 0],   // 4分+8分
                [0, 0, null, 0],   // 付点8分
            ]
        };

        for (let i = 0; i < totalMeasures; i++) {
            const pattern = patterns[level][Math.floor(Math.random() * patterns[level].length)];
            for (let j = 0; j < pattern.length; j++) {
                if (pattern[j] !== null) {
                    const time = Math.floor(i * measureDuration + (j * measureDuration / 4));
                    const lane = Math.floor(Math.random() * laneCount);
                    sheet.push({ time: time, lane: lane });
                }
            }
        }
        return sheet;
    }

    // --- イベントリスナー ---
    levelButtons.forEach(button => button.addEventListener('click', () => startGame(button.id)));
    retryButton.addEventListener('click', () => {
        resultScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
    });
    giveUpButton.addEventListener('click', showResult); // あきらめるボタン
    document.addEventListener('keydown', handleKeyPress);

    // --- ゲーム開始処理 ---
    function startGame(level) {
        let bpm, totalMeasures, audioSrc, levelName;

        // レベルに応じて設定を初期化
        judgmentLine.innerHTML = ''; // ターゲットをクリア
        [keyA, keySpace, keyEnter].forEach(k => k.style.display = 'none');

        switch (level) {
            case 'level-easy':
                bpm = 130;
                totalMeasures = 40;
                noteSpeed = 3;
                audioSrc = 'assets/audio/song-easy.mp3';
                levelName = 'easy';
                laneCount = 1;
                activeKeys = [' '];
                keyMapping = { ' ': 0 };
                keyElements = { ' ': keySpace };
                lanePositions = ['50%'];
                break;
            case 'level-normal':
                bpm = 150;
                totalMeasures = 50;
                noteSpeed = 4;
                audioSrc = 'assets/audio/song-normal.mp3';
                levelName = 'normal';
                laneCount = 2;
                activeKeys = [' ', 'Enter'];
                keyMapping = { ' ': 0, 'Enter': 1 };
                keyElements = { ' ': keySpace, 'Enter': keyEnter };
                lanePositions = ['35%', '65%'];
                break;
            case 'level-hard':
                bpm = 170;
                totalMeasures = 60;
                noteSpeed = 5;
                audioSrc = 'assets/audio/song-hard.mp3';
                levelName = 'hard';
                laneCount = 3;
                activeKeys = ['a', ' ', 'Enter'];
                keyMapping = { 'a': 0, ' ': 1, 'Enter': 2 };
                keyElements = { 'a': keyA, ' ': keySpace, 'Enter': keyEnter };
                lanePositions = ['25%', '50%', '75%'];
                break;
        }

        // UIのセットアップ
        for (let i = 0; i < laneCount; i++) {
            const target = document.createElement('div');
            target.classList.add('target');
            target.style.display = 'block';
            target.style.left = lanePositions[i];
            judgmentLine.appendChild(target);
        }
        Object.values(keyElements).forEach(el => el.style.display = 'flex');

        // タッチイベントのセットアップ
        Object.entries(keyElements).forEach(([key, element]) => {
            element.ontouchstart = (e) => {
                e.preventDefault();
                performJudgment(key);
            };
            element.ontouchend = (e) => {
                e.preventDefault();
                element.classList.remove('active');
            };
        });

        musicData = { data: generateMusicSheet(bpm, totalMeasures, levelName, laneCount) };
        startScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        score = 0;
        hp = 100;
        notes = [];
        updateScore(0);
        updateHp(0);

        if (audio) audio.pause();
        audio = new Audio(audioSrc);
        audio.play().catch(e => console.error("音楽の再生に失敗しました:", e));

        startTime = Date.now();
        gameLoop();
        audio.addEventListener('ended', showResult);
    }

    // --- ゲームループ ---
    function gameLoop() {
        if (hp <= 0) return; // HPが0ならループ停止
        const currentTime = Date.now() - startTime;
        while (musicData.data.length > 0 && musicData.data[0].time <= currentTime) {
            createNote(musicData.data.shift().lane);
        }

        const notesToRemove = [];
        notes.forEach(note => {
            const newTop = parseFloat(note.style.top) + noteSpeed;
            note.style.top = `${newTop}px`;
            if (newTop > gameArea.clientHeight) {
                notesToRemove.push(note);
                showJudgmentEffect('Miss');
                updateHp(-10); // 見逃しミスでHP減少
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
        note.style.left = lanePositions[lane];
        note.style.transform = 'translateX(-50%)';
        gameArea.insertBefore(note, judgmentLine);
        notes.push(note);
    }
    
    // --- キー入力処理 ---
    function handleKeyPress(e) {
        const key = e.key.toLowerCase();
        if(gameScreen.classList.contains('hidden') || !activeKeys.includes(key)) return;
        e.preventDefault();
        performJudgment(key);
    }

    // --- 判定実行処理 (キーボード・タッチ共通) ---
    function performJudgment(key) {
        if (hp <= 0) return; // HPが0なら判定しない
        const keyElement = keyElements[key];
        if (keyElement) {
            keyElement.classList.add('active');
            if (!('ontouchstart' in window) || !Object.values(keyElements).some(el => el.ontouchstart)) {
                 setTimeout(() => keyElement.classList.remove('active'), 100);
            }
        }

        const lane = keyMapping[key];
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
            updateHp(1); // PerfectでHP回復
        } else if (distance < 60) { // Good
            judgment = 'Good';
            updateScore(100);
        } else { // Miss
            updateHp(-10);
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

    // --- HP更新 ---
    function updateHp(amount) {
        hp += amount;
        if (hp > 100) hp = 100;
        if (hp < 0) hp = 0;
        hpBar.style.width = `${hp}%`;
        if (hp <= 0) {
            showResult();
        }
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