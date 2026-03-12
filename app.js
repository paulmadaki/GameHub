// --- CONFIGURATION ---
// Paste your full embed codes here. Use single quotes '' around the code.
const videoEmbeds = [

    // YouTube Video
    '<iframe width="560" height="315" src="https://www.youtube.com/embed/wuGlBcKcsL4" title="YouTube video player" frameborder="0" allowfullscreen></iframe>',
     // Video 1
    '<iframe width="560" height="315" src="https://www.youtube.com/embed/GYQSirOS7AY" frameborder="0" allowfullscreen></iframe>',

    // Video 2
    '<iframe width="560" height="315" src="https://www.youtube.com/embed/bSd2kEBAqSE" frameborder="0" allowfullscreen></iframe>',

    // Video 3
    '<iframe width="560" height="315" src="https://www.youtube.com/embed/Q905tQZi9F8" frameborder="0" allowfullscreen></iframe>',

    // Video 4
    '<iframe width="560" height="315" src="https://www.youtube.com/embed/IYi5bvUhgAw" frameborder="0" allowfullscreen></iframe>'

    // TikTok Video
    //'<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@tiktok/video/ZS9dpap2CQ2yu-HHCxY" data-video-id="ZS9dpap2CQ2yu-HHCxY" style="max-width: 605px;min-width: 325px;"><section></section></blockquote><script async src="https://www.tiktok.com/embed.js"></script>',

    // Facebook Video
    //'<iframe src="https://www.facebook.com/plugins/video.php?href=https://www.facebook.com/share/r/176TQzJRfJ/&show_text=false&width=560" width="560" height="315" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>'

];

const wheelSections = [
    "Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Q9","Q10",
    "Q11","Q12","Q13","Q14","Q15","Q16","Q17","Q18","Q19","Q20",
    "TRY AGAIN","TRY AGAIN","TRY AGAIN","TRY AGAIN","TRY AGAIN"
];

let currentUser = null;
let isSpinning = false;
const WAIT_TIME = 60; // Seconds users must watch the video

// --- INITIALIZE (Now checks for active locks) ---
window.onload = () => {
    renderWheelSVG();
    
    auth.signInAnonymously().then(user => {
        currentUser = user.user;
        
        // CHECK: Was the user in the middle of a video?
        const videoLock = localStorage.getItem('videoActive');
        if (videoLock === 'true') {
            console.log("Persistence: Restoring video lock...");
            showVideoModal(true); // 'true' means it's a restored session
        }
    }).catch(err => console.error("Auth Error:", err));
};

// --- DRAW WHEEL SVG ---
function renderWheelSVG() {
    const svg = document.getElementById('wheel');
    const n = wheelSections.length;
    const anglePer = 360 / n;
    
    wheelSections.forEach((text, i) => {
        const startAng = i * anglePer;
        const endAng = (i + 1) * anglePer;
        const x1 = 170 + 150 * Math.cos(Math.PI * (startAng - 90) / 180);
        const y1 = 170 + 150 * Math.sin(Math.PI * (startAng - 90) / 180);
        const x2 = 170 + 150 * Math.cos(Math.PI * (endAng - 90) / 180);
        const y2 = 170 + 150 * Math.sin(Math.PI * (endAng - 90) / 180);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M 170 170 L ${x1} ${y1} A 150 150 0 0 1 ${x2} ${y2} Z`);
        path.setAttribute("fill", i % 2 === 0 ? "#ffffff" : "#f2f2f2");
        path.setAttribute("stroke", "#ddd");
        svg.appendChild(path);

        const textNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
        const angle = startAng + anglePer / 2 - 90;
        const tx = 170 + 115 * Math.cos(Math.PI * angle / 180);
        const ty = 170 + 115 * Math.sin(Math.PI * angle / 180);
        textNode.setAttribute("x", tx);
        textNode.setAttribute("y", ty);
        textNode.setAttribute("class", "segment-label");
        textNode.setAttribute("text-anchor", "middle");
        textNode.setAttribute("transform", `rotate(${angle + 90}, ${tx}, ${ty})`);
        textNode.textContent = text;
        svg.appendChild(textNode);
    });
}

// --- SPIN LOGIC ---
document.getElementById('wheelWrapper').onclick = async () => {
    if (isSpinning || !currentUser) return;

    // Immediately start the visual spin so users get instant feedback
    const spinPromise = startSpin();

    // Run backend checks in parallel while the wheel is animating
    let needVideo = false;
    try {
        // Check if any questions remain
        const availableQuestions = await db.collection('questions')
            .where('isClaimed', '==', false)
            .limit(1)
            .get();

        if (availableQuestions.empty) {
            // wait for animation to finish, then notify
            const idx = await spinPromise;
            alert('All prizes have been won for today! Check back tomorrow.');
            isSpinning = false;
            const sb = document.getElementById('spinBtn'); if (sb) sb.disabled = false;
            return;
        }

        const userRef = db.collection("users").doc(currentUser.uid);
        const doc = await userRef.get();
        let count = doc.exists ? (doc.data().spinsCount || 0) : 0;
        count++;
        await userRef.set({ spinsCount: count }, { merge: true });

        if (count % 4 === 0) {
            needVideo = true;
        }
    } catch (err) {
        console.error('Error during spin checks:', err);
        // allow animation to finish then show error
        const idx = await spinPromise;
        alert('Unable to verify spin state. Try again later.');
        isSpinning = false;
        const sb = document.getElementById('spinBtn'); if (sb) sb.disabled = false;
        return;
    }

    // Wait for the spin animation to finish and then handle result or video
    const selectedIndex = await spinPromise;
    const selected = wheelSections[selectedIndex];
    if (needVideo) {
        showVideoModal();
    } else {
        handleResult(selected);
        isSpinning = false;
        const sb = document.getElementById('spinBtn'); if (sb) sb.disabled = false;
    }
};

// Wire the separate spin button to trigger the same click handler
const spinBtn = document.getElementById('spinBtn');
if (spinBtn) {
    spinBtn.addEventListener('click', () => {
        const wrapper = document.getElementById('wheelWrapper');
        if (wrapper) wrapper.click();
    });
}

function startSpin() {
    isSpinning = true;
    // disable manual spin button while spinning
    const sb = document.getElementById('spinBtn');
    if (sb) sb.disabled = true;

    const randomIndex = Math.floor(Math.random() * wheelSections.length);
    const deg = (360 * 5) + (randomIndex * (360 / wheelSections.length));
    document.getElementById('wheel').style.transform = `rotate(-${deg}deg)`;

    // Return a promise that resolves when the animation completes
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(randomIndex);
        }, 4000);
    });
}

// --- HANDLE SPIN RESULT ---
async function handleResult(selected) {
    const resDiv = document.getElementById('result');
    if (selected === "TRY AGAIN") {
        resDiv.innerHTML = "<h3 style='color:orange'>❌ Try Again!</h3><p>Better luck next spin.</p>";
        return;
    }

    const qId = selected.toLowerCase().trim(); 
    try {
        const qDoc = await db.collection("questions").doc(qId).get();

        if (!qDoc.exists) {
            resDiv.innerHTML = `<h3 style='color:red'>Missing Q: ${qId}</h3><p>Check Firebase console.</p>`;
            return;
        }

        const data = qDoc.data();
        if (data.isClaimed === true) {
            resDiv.innerHTML = `<h3>Already Won!</h3><p>Question ${selected} is taken. Spin again!</p>`;
        } else {
            // CALLING THE MISSING FUNCTION HERE
            renderQuestion(qId, data);
        }
    } catch (error) {
        console.error("Firebase Error:", error);
        resDiv.innerHTML = "<h3>Error connecting to database.</h3>";
    }
}

// --- RENDER QUESTION UI ---
let questionTimer = null; // Global variable to track the 12s timer
let currentVideoInterval = null; // track active video countdown interval
let currentYTPlayer = null;

// --- RENDER QUESTION UI WITH 12s TIMER ---
function renderQuestion(id, data) {
    const resDiv = document.getElementById('result');
    let timeLeft = 40; // 40 seconds per question

    // Clear any existing timer just in case
    if (questionTimer) clearInterval(questionTimer);

    resDiv.innerHTML = `
        <div id="qContainer" style="text-align:left; padding: 10px; border: 2px solid #333; border-radius: 8px;">
            <p style="color: red; font-weight: bold;">⏳ Time Left: <span id="qClock">40</span>s</p>
            <p><strong>Question ${id.toUpperCase()}:</strong></p>
            <p>${data.questionText}</p>
            <input type="text" id="ansInput" placeholder="Type fast...">
            <button id="submitBtn" onclick="checkAnswer('${id}', '${data.correctAnswer}')">Submit Answer</button>
        </div>`;

    // Start the countdown
    questionTimer = setInterval(() => {
        timeLeft--;
        const clockSpan = document.getElementById('qClock');
        if (clockSpan) clockSpan.innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(questionTimer);
            handleTimeout();
        }
    }, 1000);
}

// --- HANDLE TIMEOUT ---
function handleTimeout() {
    alert("⏰ Time is up! You were too slow. Try spinning again!");
    document.getElementById('result').innerHTML = "<p style='color:gray;'>Question expired. Spin again!</p>";
    isSpinning = false; // Allow spinning again
    // If you have a spin button element, enable it here:
    // document.getElementById('spinBtn').disabled = false;
}

// --- CHECK ANSWER (Modified to stop timer) ---
async function checkAnswer(id, correct) {
    const val = document.getElementById('ansInput').value.trim().toLowerCase();
    
    if (val === correct.toLowerCase()) {
        // STOP THE TIMER IMMEDIATELY ON SUCCESS
        if (questionTimer) clearInterval(questionTimer);

        const qRef = db.collection("questions").doc(id);
        await qRef.update({ isClaimed: true, winner: currentUser.uid });
        const freshDoc = await qRef.get();

        document.getElementById('result').innerHTML = `
            <div style="color:green; border: 2px solid green; padding: 15px; border-radius: 10px; background: #eaffea;">
                <h2>✅ CORRECT!</h2>
                <p>Your Recharge Code is:</p>
                <h1 style="background: #fff; padding: 10px; border: 1px solid #ccc;">${freshDoc.data().airtimeCode}</h1>
            </div>`;
    } else {
        // If wrong, do NOT block the UI with an alert (alerts pause timers).
        // Show a non-blocking inline message so the question timer continues running.
        showTempMessage('Wrong answer! Try again before the clock hits zero.', 'orange', 1500);
    }
}

// Show a temporary non-blocking message inside the question container (doesn't block JS timers)
function showTempMessage(text, color = 'red', duration = 1500) {
    const qContainer = document.getElementById('qContainer') || document.getElementById('result');
    if (!qContainer) return;
    // remove existing temp messages
    const existing = qContainer.querySelector('.temp-msg');
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = 'temp-msg';
    msg.style.marginTop = '8px';
    msg.style.padding = '8px 10px';
    msg.style.borderRadius = '6px';
    msg.style.background = 'rgba(0,0,0,0.06)';
    msg.style.color = color;
    msg.style.fontWeight = '600';
    msg.style.display = 'inline-block';
    msg.innerText = text;
    qContainer.appendChild(msg);

    setTimeout(() => {
        try { msg.remove(); } catch (e) {}
    }, duration);
}

// --- VIDEO MODAL & TIMER ---
// --- MODIFIED VIDEO MODAL ---
function showVideoModal(isRestored = false) {
    const modal = document.getElementById('videoModal');
    const container = document.getElementById('embedContainer');
    const timerText = document.getElementById('timerText');
    const closeBtn = document.getElementById('closeVideoBtn');
    const secondsSpan = document.getElementById('seconds');

    // 1. SET THE LOCK IN STORAGE
    localStorage.setItem('videoActive', 'true');

    modal.style.display = 'flex';
    closeBtn.style.display = 'none';
    timerText.style.display = 'block';

    // Clear any previous interval
    if (currentVideoInterval) { clearInterval(currentVideoInterval); currentVideoInterval = null; }

    // Pick a video
    const rawEmbed = videoEmbeds[Math.floor(Math.random() * videoEmbeds.length)];

    // Create a temporary wrapper to parse the embed HTML
    container.innerHTML = '';
    const temp = document.createElement('div');
    temp.innerHTML = rawEmbed.trim();

    // If the embed contains an iframe (YouTube/Facebook), modify src to autoplay and mute
    const iframe = temp.querySelector('iframe');
    if (iframe) {
        try {
            let src = iframe.getAttribute('src') || '';
            // ensure autoplay and mute params (muted helps autoplay on mobile/desktop)
            const addParams = 'autoplay=1&mute=1';
            if (src.indexOf('?') === -1) src += '?' + addParams;
            else if (!/autoplay=/.test(src)) src += '&' + addParams;
            iframe.setAttribute('src', src);
            // allow autoplay explicitly
            const allow = (iframe.getAttribute('allow') || '') + ' autoplay; encrypted-media; picture-in-picture;';
            iframe.setAttribute('allow', allow);
        } catch (e) {
            console.error('Failed to set autoplay on iframe', e);
        }
        // append iframe to container
        container.appendChild(iframe);

        // If this looks like a YouTube embed, initialize YT Player for better control
        const ytMatch = iframe.getAttribute('src') && iframe.getAttribute('src').match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        if (ytMatch) {
            const vid = ytMatch[1];
            // replace iframe with a player div
            iframe.remove();
            const playerDiv = document.createElement('div');
            playerDiv.id = 'ytPlayer';
            container.appendChild(playerDiv);

            function createYT() {
                try {
                    if (currentYTPlayer && currentYTPlayer.destroy) currentYTPlayer.destroy();
                } catch(e){}
                currentYTPlayer = new YT.Player('ytPlayer', {
                    height: '315', width: '560', videoId: vid,
                    playerVars: { autoplay: 1, mute: 1, controls: 1, rel: 0, modestbranding: 1 },
                    events: {
                        onReady: (e) => { try { e.target.playVideo(); } catch(e){} },
                        onStateChange: (e) => {}
                    }
                });

                // show unmute button (user gesture required to unmute)
                const unmuteBtn = document.getElementById('unmuteBtn');
                if (unmuteBtn) {
                    unmuteBtn.style.display = 'inline-block';
                    unmuteBtn.onclick = () => {
                        try { currentYTPlayer.unMute(); currentYTPlayer.playVideo(); } catch(e){}
                        unmuteBtn.style.display = 'none';
                    };
                }
            }

            if (window.YT && window.YT.Player) {
                createYT();
            } else {
                // load API then create
                if (!document.getElementById('yt-api')) {
                    const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; tag.id = 'yt-api';
                    document.head.appendChild(tag);
                }
                window.onYouTubeIframeAPIReady = createYT;
            }
        }
    } else {
        // Otherwise append whatever HTML (e.g., TikTok blockquote + script)
        // Append child nodes and re-run any scripts
        Array.from(temp.childNodes).forEach(node => {
            container.appendChild(node.cloneNode(true));
        });
        // Execute scripts inside container (recreate to run)
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            if (oldScript.src) newScript.src = oldScript.src;
            else newScript.textContent = oldScript.textContent;
            document.body.appendChild(newScript);
            oldScript.remove();
        });
    }

    // Penalty logic: If they refresh, restart the timer as a deterrent
    let timeLeft = WAIT_TIME; 
    secondsSpan.innerText = timeLeft;

    if (questionTimer) clearInterval(questionTimer); // Stop any question clocks

    currentVideoInterval = setInterval(() => {
        timeLeft--;
        if (secondsSpan) secondsSpan.innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(currentVideoInterval);
            currentVideoInterval = null;
            timerText.style.display = 'none';
            closeBtn.style.display = 'block';
            // hide unmute when timer ends (optional)
            const unmuteBtn = document.getElementById('unmuteBtn'); if (unmuteBtn) unmuteBtn.style.display = 'none';
        }
    }, 1000);
}

// --- UNLOCK FUNCTION (Clears the lock) ---
function unlockGame() {
    // 2. REMOVE THE LOCK FROM STORAGE
    localStorage.removeItem('videoActive');
    
    document.getElementById('videoModal').style.display = 'none';
    document.getElementById('embedContainer').innerHTML = ""; 
    // clear video interval if present
    if (currentVideoInterval) { clearInterval(currentVideoInterval); currentVideoInterval = null; }
    // destroy YT player if exists
    try { if (currentYTPlayer && currentYTPlayer.destroy) currentYTPlayer.destroy(); currentYTPlayer = null; } catch(e){}
    // Ensure the UI is unlocked: clear spinning state and re-enable spin button
    isSpinning = false;
    const sb = document.getElementById('spinBtn');
    if (sb) {
        sb.disabled = false;
        try { sb.focus(); } catch (e) {}
    }

    // Use a non-blocking message instead of alert to avoid pausing timers
    try { showTempMessage('Task complete! You can now spin.', 'green', 3000); } catch (e) { /* fallback */ }
}