document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const resultScreen = document.getElementById('result-screen');
    const scoreDisplay = document.getElementById('score');
    const finalScoreDisplay = document.getElementById('final-score');
    const gameArea = document.getElementById('game-area');
    const judgmentLine = document.getElementById('judgment-line');
    const keySpace = document.getElementById('key-space');
    const hpBar = document.getElementById('hp-bar');

    // --- ボタン要素の取得 ---
    const levelButtons = [
        document.getElementById('level-easy'),
        document.getElementById('level-normal'),
        document.getElementById('level-hard')
    ];
    const retryButton = document.getElementById('retry-button');
    const giveUpButton = document.getElementById('give-up-button');

    // --- ゲーム設定 (1ボタン仕様) ---
    let score = 0;
    let hp = 0;
    let notes = [];
    let audio;
    let musicData;
    let startTime;
    let gameInterval;
    let noteSpeed = 3; // ノーツの落下速度
    const keyMapping = { ' ': 0 }; // スペースキーのみ
    const keyElements = { ' ': keySpace };

    // --- 新しい譜面データ生成 ---
    function generateMusicSheet(bpm, totalMeasures, level) {
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
                    sheet.push({ time: time, lane: 0 });
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
    // スマホ・タブレット用のタッチイベント
    keySpace.addEventListener('touchstart', (e) => {
        e.preventDefault(); // 画面のスクロールを防ぐ
        performJudgment(' ');
    });
    keySpace.addEventListener('touchend', (e) => {
        e.preventDefault();
        const keyElement = keyElements[' '];
        if (keyElement) {
            keyElement.classList.remove('active');
        }
    });

    // --- ゲーム開始処理 ---
    function startGame(level) {
        let bpm, totalMeasures, audioSrc, levelName;

        switch (level) {
            case 'level-easy':
                bpm = 130;
                totalMeasures = 40; // 約1分
                noteSpeed = 3;
                audioSrc = 'assets/audio/song-easy.mp3';
                levelName = 'easy';
                break;
            case 'level-normal':
                bpm = 150;
                totalMeasures = 50; // 約1分20秒
                noteSpeed = 4;
                audioSrc = 'assets/audio/song-normal.mp3';
                levelName = 'normal';
                break;
            case 'level-hard':
                bpm = 170;
                totalMeasures = 60; // 約1分25秒
                noteSpeed = 5;
                audioSrc = 'assets/audio/song-hard.mp3';
                levelName = 'hard';
                break;
        }

        musicData = { data: generateMusicSheet(bpm, totalMeasures, levelName) };
        startScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        score = 0;
        hp = 100;
        notes = [];
        updateScore(0);
        updateHp(0);

        // gameAreaの子要素をjudgmentLine以外削除
        while (gameArea.children.length > 1) {
            if(gameArea.firstChild !== judgmentLine) {
                gameArea.removeChild(gameArea.firstChild);
            } else if (gameArea.lastChild !== judgmentLine) {
                gameArea.removeChild(gameArea.lastChild);
            }
        }

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

    // --- ノーツ生成 (1レーン仕様) ---
    function createNote(lane) {
        const note = document.createElement('div');
        note.classList.add('note');
        note.dataset.lane = lane; // データとしては保持
        note.style.top = '0px';
        note.style.left = '50%'; // 中央に配置
        gameArea.insertBefore(note, judgmentLine);
        notes.push(note);
    }
    
    // --- キー入力処理 ---
    function handleKeyPress(e) {
        // ゲーム画面が表示されていない、またはスペースキーでない場合は処理しない
        if(gameScreen.classList.contains('hidden') || e.key !== ' ') return;
        e.preventDefault(); // スペースキーでのスクロールを防ぐ
        performJudgment(' ');
    }

    // --- 判定実行処理 (キーボード・タッチ共通) ---
    function performJudgment(key) {
        if (hp <= 0) return; // HPが0なら判定しない
        const keyElement = keyElements[key];
        if (keyElement) {
            keyElement.classList.add('active');
            // touchendでクラスを削除するため、キーボードの場合はsetTimeoutで削除
            if (!('ontouchstart' in window)) {
                 setTimeout(() => keyElement.classList.remove('active'), 100);
            }
        }

        if (notes.length === 0) return;

        const judgmentLinePosition = judgmentLine.offsetTop;
        // 最も判定ラインに近いノーツを探す
        const closestNote = notes.reduce((closest, current) => {
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