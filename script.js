const canvas = document.getElementById("neuralCanvas");
const ctx = canvas.getContext("2d");
let particles = [];

let pretextPrepare = null;
let pretextLayout = null;
let activeMissionType = "profile";

import("https://esm.sh/@chenglou/pretext")
    .then(module => {
        pretextPrepare = module.prepare;
        pretextLayout = module.layout;
        renderMission(activeMissionType);
    })
    .catch(() => {
        renderMission(activeMissionType);
    });
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createParticles();
}

function createParticles() {
    const count = Math.min(80, Math.floor(window.innerWidth / 18));
    particles = [];

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.45,
            vy: (Math.random() - 0.5) * 0.45,
            r: Math.random() * 1.8 + 0.8
        });
    }
}

function drawNetwork() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(66, 233, 188, 0.65)";
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
            const q = particles[j];
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 125) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.strokeStyle = "rgba(105, 128, 255, " + (1 - dist / 125) * 0.22 + ")";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    requestAnimationFrame(drawNetwork);
}

resizeCanvas();
drawNetwork();
window.addEventListener("resize", resizeCanvas);

const missionData = {
    profile: {
        title: "IDENTIFY_AI_CANDIDATE",
        meta: "> output: candidate_profile.md",
        body: `
      <p>
        안녕하세요. 저는 웹 프로그래밍을 배우며 인공지능 분야로 성장하고 싶은 김건희입니다.
        처음에는 HTML, CSS, JavaScript를 활용해 웹페이지의 화면을 구성하는 것에 관심을 가졌지만,
        공부를 하면서 웹 서비스는 단순히 화면만으로 완성되는 것이 아니라는 점을 알게 되었습니다.
      </p>
      <p>
        저는 장기적으로 인공지능 분야에서 일하는 것을 목표로 하고 있습니다.
        AI 서비스가 실제 사용자에게 제공되기 위해서는 AI 모델 자체뿐만 아니라
        서버, 네트워크, 클라우드, 보안과 같은 기반 기술이 함께 필요하다고 생각합니다.
      </p>
    `
    },

    growth: {
        title: "TRACE_LEARNING_ROUTE",
        meta: "> route traced: web to server to network to ai",
        body: `
      <p>
        웹 프로그래밍을 공부하면서 사용자의 화면을 구성하는 것뿐만 아니라,
        그 뒤에서 서버와 데이터가 어떻게 연결되는지에 관심을 가지게 되었습니다.
        웹페이지가 서버와 데이터를 주고받으며 하나의 서비스로 동작한다는 점이 특히 흥미로웠습니다.
      </p>
      <p>
        이 관심은 자연스럽게 네트워크와 시스템 구조에 대한 궁금증으로 이어졌고,
        AI 서비스 역시 이러한 기반 위에서 동작한다는 점을 알게 되면서
        인공지능 분야라는 장기 목표와 연결되었습니다.
      </p>
    `
    },

    problem: {
        title: "DEBUG_PROBLEM_PACKET",
        meta: "> packet error detected: analyzing cause",
        body: `
      <p>
        웹 프로그래밍 실습을 진행하면서 화면 배치가 깨지거나 JavaScript 이벤트가 실행되지 않는 등
        원하는 기능이 바로 동작하지 않는 경우가 많았습니다.
        처음에는 오류의 원인을 찾는 것이 막막했지만, 오류 메시지를 확인하고 코드를 작은 단위로 나누어 점검하면서
        문제를 해결하는 방법을 배웠습니다.
      </p>
      <p>
        이 경험을 통해 문제 해결은 한 번에 정답을 찾는 일이 아니라,
        데이터의 흐름을 추적하듯 단계별로 원인을 좁혀 가는 과정이라는 것을 알게 되었습니다.
      </p>
    `
    },

    team: {
        title: "RESTORE_TEAM_SESSION",
        meta: "> team session unstable: restoring communication",
        body: `
      <p>
        팀 프로젝트에서는 각자 생각하는 방향이 다를 수 있다는 것을 배웠습니다.
        의견이 충돌할 때는 먼저 상대방의 의견을 듣고,
        기능의 목적과 사용자 입장에서 더 나은 방향을 기준으로 판단하려고 했습니다.
      </p>
      <p>
        협업은 단순히 역할을 나누는 것이 아니라,
        서로 다른 생각을 연결해 하나의 결과물로 만드는 과정이라고 생각합니다.
        앞으로 연구실에서도 소통을 중요하게 생각하며 프로젝트에 참여하고 싶습니다.
      </p>
    `
    },

    failure: {
        title: "ANALYZE_FAILURE_LOG",
        meta: "> reading failure_log.txt",
        body: `
      <p>
        처음부터 완성도 높은 결과물을 만들려고 하다가 오히려 진행이 늦어진 경험이 있습니다.
        전체 구조를 완벽하게 잡으려다 보니 작은 기능을 완성하고 확인하는 과정이 부족했습니다.
      </p>
      <p>
        이후에는 작은 단위부터 구현하고, 동작을 확인한 뒤 점차 개선하는 방식이 더 효과적이라는 것을 배웠습니다.
        실패는 다음 시도에서 더 나은 선택을 하기 위한 로그라고 생각합니다.
      </p>
    `
    },

    issue: {
        title: "SECURITY_AND_AI_ISSUE",
        meta: "> opened: society_issue.packet",
        body: `
      <p>
        최근 AI 서비스가 빠르게 확산되면서 데이터 보안과 네트워크 안정성의 중요성이 함께 커지고 있습니다.
        AI가 많은 데이터를 활용하는 만큼 개인정보 보호와 안전한 통신 환경은 더욱 중요한 문제가 되었습니다.
      </p>
      <p>
        저는 AI 기술이 발전할수록 모델의 성능뿐만 아니라,
        그 모델이 연결되는 서버와 네트워크 구조의 신뢰성도 함께 고려해야 한다고 생각합니다.
      </p>
    `
    },

    interest: {
        title: "LOAD_AI_NETWORK_PROTOCOL",
        meta: "> loading interest.protocol",
        body: `
      <p>
        제가 관심을 가지고 있는 분야는 인공지능, 웹 서비스, 서버/API, 컴퓨터 네트워크,
        클라우드, 네트워크 보안입니다.
        특히 AI 모델을 단순히 사용하는 것에서 끝나는 것이 아니라,
        실제 웹이나 앱 서비스에 연결하고 사용자에게 안정적으로 제공하는 과정에 관심이 있습니다.
      </p>
      <ul>
        <li>Artificial Intelligence: 머신러닝, 딥러닝, LLM 활용</li>
        <li>AI Service: AI 모델을 웹/앱 서비스에 연결하는 구조</li>
        <li>Computer Network: HTTP, TCP/IP, 라우팅, 지연 시간</li>
        <li>Cloud & Server: API, 배포, 서버 운영 환경</li>
        <li>Network Security: 인증, 암호화, 이상 트래픽 탐지</li>
      </ul>
    `
    },

    lab: {
        title: "CONNECT_TO_NETWORK_LAB",
        meta: "> connection request sent: network_lab",
        body: `
      <p>
        네트워크는 웹 서비스, 모바일 서비스, 클라우드, 보안, AI 서비스까지 다양한 기술의 기반이 됩니다.
        저는 이러한 기반 기술을 깊이 이해하고 싶어 네트워크 연구실 진학을 목표로 하게 되었습니다.
      </p>
      <p>
        저에게 네트워크 연구실은 최종 목적지가 아니라 AI 분야로 나아가기 위한 중요한 경로입니다.
        연구실에서 네트워크 구조와 프로토콜, 보안, 트래픽 분석 등을 공부하고,
        이를 바탕으로 AI 서비스 개발 역량과 연결하고 싶습니다.
      </p>
    `
    }
};

function stripHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
}

function getPretextStatus(title, body) {
    const missionView = document.getElementById("missionView");

    if (!pretextPrepare || !pretextLayout) {
        return `
      <div class="pretext-status">
        PRETEXT_LAYOUT / <span>loading text layout engine...</span>
      </div>
    `;
    }

    const plainText = title + "\n" + stripHtml(body);
    const width = Math.max(280, missionView.clientWidth - 68);
    const font = "16px Arial";
    const lineHeight = 30;

    const prepared = pretextPrepare(plainText, font);
    const result = pretextLayout(prepared, width, lineHeight);

    const textHeight = Math.round(result.height || 0);
    const lineCount = result.lineCount || Math.max(1, Math.round(textHeight / lineHeight));

    missionView.style.minHeight = Math.max(560, textHeight + 180) + "px";

    return `
    <div class="pretext-status">
      PRETEXT_LAYOUT /
      <span>lines: ${lineCount}</span> /
      <span>text height: ${textHeight}px</span> /
      <span>width: ${Math.round(width)}px</span>
    </div>
  `;
}

function renderMission(type) {
    const data = missionData[type];
    const missionView = document.getElementById("missionView");
    const pretextStatus = getPretextStatus(data.title, data.body);

    missionView.innerHTML = `
    <h3>${data.title}</h3>
    <div class="mission-meta">${data.meta}</div>
    ${data.body}
    ${pretextStatus}
  `;
}

function openMission(type, element) {
    const buttons = document.querySelectorAll(".mission-btn");

    activeMissionType = type;

    buttons.forEach(button => button.classList.remove("active"));
    element.classList.add("active");

    renderMission(type);
}

const reveals = document.querySelectorAll(".reveal");
const bars = document.querySelectorAll(".bar span");

function onScroll() {
    reveals.forEach(element => {
        const top = element.getBoundingClientRect().top;

        if (top < window.innerHeight - 120) {
            element.classList.add("show");
        }
    });

    bars.forEach(bar => {
        const top = bar.getBoundingClientRect().top;

        if (top < window.innerHeight - 80) {
            bar.style.width = bar.dataset.width;
        }
    });
}

window.addEventListener("scroll", onScroll);

window.addEventListener("load", () => {
    onScroll();
    renderMission(activeMissionType);
});

window.addEventListener("resize", () => {
    renderMission(activeMissionType);
});

const bootLog = document.getElementById("bootLog");
const extraLogs = [
    "> mapping interest vector: AI service + network",
    "> optimizing future route: lab research to AI career",
    "> deploy target confirmed: AI Developer",
    "> model confidence updated"
];

let logIndex = 0;

setInterval(() => {
    if (logIndex >= extraLogs.length) return;

    const line = document.createElement("p");
    line.className = "log-line";
    line.innerHTML = extraLogs[logIndex].replace("AI Developer", "<span>AI Developer</span>");
    bootLog.appendChild(line);
    logIndex++;
}, 1800);