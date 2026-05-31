const canvas = document.getElementById("neuralCanvas");
const ctx = canvas.getContext("2d");
let particles = [];

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

let pretextApi = null;
let packetLayoutTimer = null;
let packetRoutingRaf = null;
const packetPreparedCache = new WeakMap();
const packetRoutingState = new WeakMap();
const ROUTING_ACTIVATE_PADDING = 22;
const ROUTING_DEACTIVATE_PADDING = 10;
const ROUTING_HOLD_MS = 220;
const TEXT_AVOID_MAX_SHIFT = 18;
const TEXT_AVOID_INTERVAL_MS = 32;
const PACKET_ROUTE_LANES = [16, 24, 32, 40, 48, 56, 64, 72, 80];
let lastTextAvoidAt = 0;

function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function pickRandomLaneIndex(excludedIndices) {
    const candidates = PACKET_ROUTE_LANES
        .map((_, index) => index)
        .filter(index => !excludedIndices.has(index));
    const pool = candidates.length ? candidates : PACKET_ROUTE_LANES.map((_, index) => index);
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
}

function assignRandomPacketRoute(chip, previousLaneIndex) {
    const currentLaneIndex = Number.parseInt(chip.dataset.laneIndex || "-1", 10);
    const excluded = new Set();

    if (Number.isInteger(currentLaneIndex) && currentLaneIndex >= 0) {
        excluded.add(currentLaneIndex);
    }

    if (Number.isInteger(previousLaneIndex) && previousLaneIndex >= 0) {
        excluded.add(previousLaneIndex);
    }

    const laneIndex = pickRandomLaneIndex(excluded);
    const lanePercent = PACKET_ROUTE_LANES[laneIndex];
    const duration = randomInRange(8.8, 12.4);
    const negativeDelay = -randomInRange(0, duration);
    const spawnX = randomInRange(-134, -56);
    const laneJitter = randomInRange(-2.4, 2.4);

    chip.style.setProperty("--track", lanePercent.toFixed(2) + "%");
    chip.style.setProperty("--route-duration", duration.toFixed(2) + "s");
    chip.style.setProperty("--route-delay", negativeDelay.toFixed(2) + "s");
    chip.style.setProperty("--spawn-x", spawnX.toFixed(1) + "px");
    chip.style.setProperty("--lane-jitter", laneJitter.toFixed(1) + "px");
    chip.dataset.laneIndex = String(laneIndex);

    return laneIndex;
}

function initPacketChipRoutes() {
    const chips = document.querySelectorAll(".packet-field .packet-chip");

    if (!chips.length) {
        return;
    }

    let previousLaneIndex = -1;

    chips.forEach(chip => {
        previousLaneIndex = assignRandomPacketRoute(chip, previousLaneIndex);

        chip.addEventListener("animationiteration", () => {
            const currentLaneIndex = Number.parseInt(chip.dataset.laneIndex || "-1", 10);
            assignRandomPacketRoute(chip, currentLaneIndex);
        });
    });
}

function estimateTextLayout(text, width, lineHeight) {
    const averageCharWidth = 7.2;
    const safeWidth = Math.max(width, 160);
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    const charBudget = Math.max(8, Math.floor(safeWidth / averageCharWidth));
    let currentLine = "";

    words.forEach(word => {
        if (!currentLine) {
            currentLine = word;
            return;
        }

        if ((currentLine.length + 1 + word.length) <= charBudget) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    if (!lines.length) {
        lines.push(text);
    }

    const packedLines = lines.map(line => ({
        text: line,
        width: Math.min(safeWidth, line.length * averageCharWidth)
    }));

    return {
        height: packedLines.length * lineHeight,
        lines: packedLines
    };
}

function getPreparedPacketText(textElement, text, font) {
    const cached = packetPreparedCache.get(textElement);

    if (cached && cached.text === text && cached.font === font) {
        return cached;
    }

    const prepared = {
        text,
        font,
        plain: null,
        rich: null
    };

    if (pretextApi && pretextApi.prepare) {
        prepared.plain = pretextApi.prepare(text, font);
    }

    if (pretextApi && pretextApi.prepareWithSegments) {
        prepared.rich = pretextApi.prepareWithSegments(text, font);
    }

    packetPreparedCache.set(textElement, prepared);
    return prepared;
}

function normalizePretextLines(lines) {
    if (!Array.isArray(lines) || !lines.length) {
        return null;
    }

    return lines.map(line => {
        if (typeof line === "string") {
            return { text: line, width: 0 };
        }

        if (!line || typeof line !== "object") {
            return { text: "", width: 0 };
        }

        return {
            text: typeof line.text === "string" ? line.text : "",
            width: typeof line.width === "number" ? line.width : 0
        };
    });
}

function buildPacketTextLayout(textElement, text, width, lineHeight, font) {
    const fallback = estimateTextLayout(text, width, lineHeight);

    if (!pretextApi) {
        return fallback;
    }

    try {
        const prepared = getPreparedPacketText(textElement, text, font);

        if (prepared.rich && pretextApi.layoutWithLines) {
            const richLayout = pretextApi.layoutWithLines(prepared.rich, width, lineHeight);
            const lines = normalizePretextLines(richLayout.lines);

            if (lines && lines.length) {
                return {
                    height: richLayout.height || (lines.length * lineHeight),
                    lines
                };
            }
        }

        if (prepared.plain && pretextApi.layout) {
            const basicLayout = pretextApi.layout(prepared.plain, width, lineHeight);
            return {
                height: basicLayout.height || fallback.height,
                lines: fallback.lines
            };
        }
    } catch (_) {
        return fallback;
    }

    return fallback;
}

function renderPacketTextLines(textElement, lines, width) {
    const fragment = document.createDocumentFragment();
    const safeLines = lines && lines.length ? lines : [{ text: textElement.dataset.sourceText || "", width: 0 }];

    safeLines.forEach((line, index) => {
        const lineText = (line.text || "").trim();
        const lineNode = document.createElement("span");
        const isLast = index === safeLines.length - 1;
        const lineWidth = typeof line.width === "number" ? line.width : 0;
        const compactLength = lineText.replace(/\s+/g, "").length;

        lineNode.className = "pretext-line";
        Array.from(lineText).forEach(char => {
            if (char === " ") {
                lineNode.appendChild(document.createTextNode(" "));
                return;
            }

            const charNode = document.createElement("span");
            charNode.className = "pretext-char";
            charNode.textContent = char;
            lineNode.appendChild(charNode);
        });

        if (!isLast && lineText && lineWidth > 0 && compactLength > 1) {
            const availableGap = Math.max(0, width - lineWidth);
            const movableCount = Math.max(1, compactLength - 1);
            const spacing = Math.min(0.34, availableGap / movableCount);

            if (spacing > 0.015 && availableGap > 1.5) {
                lineNode.classList.add("is-justifiable");
                lineNode.style.setProperty("--packet-justify-spacing", spacing.toFixed(3) + "px");
            }
        }

        fragment.appendChild(lineNode);
    });

    textElement.classList.add("packet-copy");
    textElement.innerHTML = "";
    textElement.appendChild(fragment);
}

function applyPretextPacketLayout() {
    const packetTexts = document.querySelectorAll(".packet-card p");

    packetTexts.forEach(textElement => {
        const card = textElement.closest(".packet-card");
        const sourceText = (textElement.dataset.sourceText || textElement.textContent || "").replace(/\s+/g, " ").trim();
        const width = Math.max(160, (card ? card.clientWidth : 296) - 36);
        const styles = window.getComputedStyle(textElement);
        const font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
        const lineHeightValue = parseFloat(styles.lineHeight);
        const lineHeight = Number.isFinite(lineHeightValue) ? lineHeightValue : 23.8;

        if (!sourceText) {
            return;
        }

        textElement.dataset.sourceText = sourceText;
        const result = buildPacketTextLayout(textElement, sourceText, width, lineHeight, font);
        renderPacketTextLines(textElement, result.lines, width);
        textElement.style.minHeight = result.height + "px";
    });
}

function schedulePacketLayout() {
    clearTimeout(packetLayoutTimer);
    packetLayoutTimer = setTimeout(applyPretextPacketLayout, 120);
}

import("https://esm.sh/@chenglou/pretext")
    .then(module => {
        pretextApi = module;
        applyPretextPacketLayout();
    })
    .catch(() => {
        applyPretextPacketLayout();
    });

window.addEventListener("resize", schedulePacketLayout);
window.addEventListener("load", applyPretextPacketLayout);

function isIntersectingWithPadding(a, b, padding) {
    return !(
        a.right < b.left + padding ||
        a.left > b.right - padding ||
        a.bottom < b.top + padding ||
        a.top > b.bottom - padding
    );
}

function getPacketRoutingState(card) {
    let state = packetRoutingState.get(card);

    if (!state) {
        state = {
            active: card.classList.contains("is-routing"),
            lastHitAt: 0
        };
        packetRoutingState.set(card, state);
    }

    return state;
}

function syncPacketRoutingState(timestamp) {
    const packetField = document.querySelector(".packet-field");
    const cards = packetField ? packetField.querySelectorAll(".packet-card") : [];
    const chips = packetField ? packetField.querySelectorAll(".packet-chip") : [];

    if (!packetField || !cards.length || !chips.length) {
        return;
    }

    const chipRects = Array.from(chips, chip => chip.getBoundingClientRect());

    cards.forEach(card => {
        const state = getPacketRoutingState(card);
        const cardRect = card.getBoundingClientRect();

        const intersects = chipRects.some(chipRect => {
            return isIntersectingWithPadding(cardRect, chipRect, ROUTING_ACTIVATE_PADDING);
        });

        if (intersects) {
            state.lastHitAt = timestamp;

            if (!state.active) {
                state.active = true;
                card.classList.add("is-routing");
            }

            return;
        }

        if (!state.active) {
            return;
        }

        if ((timestamp - state.lastHitAt) < ROUTING_HOLD_MS) {
            return;
        }

        const intersectsNarrow = chipRects.some(chipRect => {
            return isIntersectingWithPadding(cardRect, chipRect, ROUTING_DEACTIVATE_PADDING);
        });

        if (!intersectsNarrow) {
            state.active = false;
            card.classList.remove("is-routing");
        }
    });

    applyPacketTextAvoidance(cards, chipRects, timestamp);
}

function applyPacketTextAvoidance(cards, chipRects, timestamp) {
    if ((timestamp - lastTextAvoidAt) < TEXT_AVOID_INTERVAL_MS) {
        return;
    }

    lastTextAvoidAt = timestamp;

    cards.forEach(card => {
        const lines = card.querySelectorAll(".pretext-line");

        lines.forEach(line => {
            const charNodes = line.querySelectorAll(".pretext-char");

            if (!charNodes.length) {
                return;
            }

            const lineRect = line.getBoundingClientRect();
            const lineCenterY = (lineRect.top + lineRect.bottom) / 2;
            const lineHeight = Math.max(14, lineRect.height);
            const nearbyChips = chipRects.filter(chipRect => {
                const chipCenterY = (chipRect.top + chipRect.bottom) / 2;
                const verticalGap = Math.abs(chipCenterY - lineCenterY);
                const verticalRange = lineHeight * 0.95;

                if (verticalGap > verticalRange) {
                    return false;
                }

                return !(chipRect.right < (lineRect.left - 14) || chipRect.left > (lineRect.right + 14));
            });

            if (!nearbyChips.length) {
                charNodes.forEach(charNode => {
                    charNode.style.setProperty("--char-avoid-x", "0px");
                });
                return;
            }

            charNodes.forEach(charNode => {
                const charRect = charNode.getBoundingClientRect();
                const charCenterY = (charRect.top + charRect.bottom) / 2;
                const charCenterX = (charRect.left + charRect.right) / 2;
                const charHeight = Math.max(12, charRect.height);
                const verticalRange = charHeight * 0.9;
                let bestOffset = 0;

                nearbyChips.forEach(chipRect => {
                    const chipCenterX = (chipRect.left + chipRect.right) / 2;
                    const chipCenterY = (chipRect.top + chipRect.bottom) / 2;
                    const verticalGap = Math.abs(chipCenterY - charCenterY);

                    if (verticalGap > verticalRange) {
                        return;
                    }

                    const overlapLeft = Math.max(charRect.left, chipRect.left);
                    const overlapRight = Math.min(charRect.right, chipRect.right);
                    const overlapX = overlapRight - overlapLeft;

                    let horizontalGap = 0;
                    if (overlapX < 0) {
                        horizontalGap = -overlapX;
                    }

                    if (horizontalGap > 11) {
                        return;
                    }

                    const direction = charCenterX < chipCenterX ? -1 : 1;
                    const verticalFactor = Math.max(0, 1 - (verticalGap / verticalRange));
                    const horizontalFactor = Math.max(0, 1 - (horizontalGap / 11));
                    const overlapBoost = Math.max(0, overlapX) * 0.38;
                    const shiftAmount = Math.min(
                        TEXT_AVOID_MAX_SHIFT,
                        (5 + overlapBoost) * verticalFactor * (0.55 + horizontalFactor)
                    );
                    const shift = direction * shiftAmount;

                    if (Math.abs(shift) > Math.abs(bestOffset)) {
                        bestOffset = shift;
                    }
                });

                charNode.style.setProperty("--char-avoid-x", bestOffset.toFixed(2) + "px");
            });
        });
    });
}

function startPacketRoutingWatcher() {
    if (packetRoutingRaf !== null) {
        return;
    }

    const loop = timestamp => {
        syncPacketRoutingState(timestamp);
        packetRoutingRaf = requestAnimationFrame(loop);
    };

    packetRoutingRaf = requestAnimationFrame(loop);
}

startPacketRoutingWatcher();
initPacketChipRoutes();

const missionData = {
    profile: {
        title: "IDENTIFY_AI_CANDIDATE",
        meta: "> output: candidate_profile.md",
        body: `
      <p>
        안녕하세요. 저는 국립공주대학교 소프트웨어학과에서 공부하며
        AI와 네트워크를 연결한 서비스를 만들고 싶은 개발자 김건희입니다.
        최근 빠르게 발전하는 AI가 검색, 추천, 자동화, 번역처럼 사회의 다양한 영역에 들어오고,
        일상생활을 더 편리하게 만드는 모습에 큰 매력을 느꼈습니다.
        기술이 사람의 일상 경험을 바꾸는 과정을 보며 저도 실질적인 변화를 만드는 개발자가 되고 싶다고 생각했습니다.
      </p>
      <p>
        제가 이루고 싶은 목표는 AI를 활용해 학석사 연구실인 네트워크 연구실에서
        조금 더 나은 서비스를 개발하는 것입니다.
        단순히 AI 모델을 사용하는 데 그치지 않고, 모델이 실제 사용자에게 안정적으로 전달되는 구조까지 이해하고 싶습니다.
        모델 성능과 서비스 운영 품질을 함께 고려할 수 있는 개발 역량을 갖추는 것이 저의 핵심 목표입니다.
      </p>
    `
    },

    growth: {
        title: "TRACE_LEARNING_ROUTE",
        meta: "> route traced: network to ai service",
        body: `
      <p>
        저에게 가장 큰 영향을 준 사건은 군 복무 이후 다시 사회의 기술 변화를 체감한 경험입니다.
        복귀 후에는 AI가 더 이상 먼 미래의 기술이 아니라 이미 생활 속에서 자연스럽게 사용되는 기술이라는 것을 느꼈습니다.
      </p>
      <p>
        이 경험을 통해 변화하는 기술을 따라가기 위해서는 꾸준히 배우고 직접 구현해보는 자세가 중요하다는 것을 깨달았습니다.
        특히 AI 서비스가 안정적으로 제공되기 위해서는 네트워크 구조와 데이터 이동 과정이 중요하다고 생각했고,
        이것이 네트워크 연구실에서 AI 서비스 개발 역량을 키우고 싶다는 목표와 연결되었습니다.
        결국 저의 성장 과정은 단순한 흥미에서 출발해, 실제 서비스를 만드는 구체적인 진로 계획으로 이어졌습니다.
      </p>
    `
    },

    problem: {
        title: "DEBUG_PROBLEM_PACKET",
        meta: "> packet error detected: analyzing cause",
        body: `
      <p>
        프로젝트를 진행하면서 처음에는 기능 구현 방향을 명확히 잡지 못했던 적이 있습니다.
        단순히 코드를 작성하는 것보다 먼저 필요한 기능을 정리하고,
        입력과 출력이 무엇인지 구분하며 전체 흐름을 작은 단계로 나누는 과정이 중요하다는 것을 알게 되었습니다.
      </p>
      <p>
        이후에는 기능을 한 번에 완성하려 하기보다 작은 단위로 구현하고 테스트하면서 문제를 해결했습니다.
        이 경험을 통해 개발에서 중요한 것은 막연히 시작하는 것이 아니라,
        문제를 구조화하고 차근차근 검증하는 태도라는 것을 배웠습니다.
        지금은 새로운 기능을 시작할 때 먼저 요구사항과 검증 기준을 적어두는 습관을 만들고 있습니다.
      </p>
    `
    },

    team: {
        title: "RESTORE_TEAM_SESSION",
        meta: "> team session unstable: restoring communication",
        body: `
      <p>
        첫 팀 프로젝트를 시작했을 때는 어떤 부분을 공유해야 하는지,
        원하는 결과물을 얻기 위해 어떤 방식으로 역할을 나누고 소통해야 하는지 감이 잘 잡히지 않았습니다.
      </p>
      <p>
        하지만 프로젝트를 실제로 진행하면서 서로의 진행 상황을 공유하고,
        필요한 기능을 구체적으로 정리하며, 문제가 생겼을 때 바로 이야기하는 것이 중요하다는 것을 알게 되었습니다.
        처음에는 서툴렀지만 일단 시작하고 부딪히면서 협업 방식에 대한 감을 익힐 수 있었습니다.
        이후에는 역할 분담 기준과 중간 점검 주기를 먼저 정해 협업 효율을 높이려고 노력하고 있습니다.
      </p>
    `
    },

    failure: {
        title: "ANALYZE_FAILURE_LOG",
        meta: "> reading failure_log.txt",
        body: `
      <p>
        처음 프로젝트를 진행할 때 계획보다 구현을 먼저 시작해 오히려 시간이 더 오래 걸렸던 경험이 있습니다.
        기능을 빠르게 만들고 싶다는 생각에 전체 구조를 충분히 정리하지 않고 코드를 작성했지만,
        이후 기능이 추가되면서 코드 흐름이 복잡해지고 수정해야 할 부분이 많아졌습니다.
      </p>
      <p>
        이 경험을 통해 개발에서는 속도만큼이나 설계와 정리가 중요하다는 것을 배웠습니다.
        이후에는 구현 전에 필요한 기능, 데이터 흐름, 역할 분담을 먼저 정리하려고 노력하고 있습니다.
        실패를 줄이는 가장 좋은 방법은 처음부터 완벽하게 만드는 것이 아니라, 초기에 구조를 명확히 두는 것이라고 느꼈습니다.
      </p>
    `
    },

    issue: {
        title: "TRACE_NETWORK_LIMIT",
        meta: "> opened: network_issue.packet",
        body: `
      <p>
        최근 사회 이슈 중 중요하다고 생각하는 것은 네트워크 환경에서 증가하는 데이터 전송량과 그로 인한 한계입니다.
        AI 서비스, 클라우드, 스트리밍, 사물인터넷 기기들이 늘어나면서 네트워크에는 점점 더 많은 데이터가 오가고 있습니다.
      </p>
      <p>
        이 과정에서 지연 시간, 대역폭 부족, 안정성 문제가 발생할 수 있으며,
        AI를 통해 트래픽을 예측하거나 효율적인 경로를 선택한다면 더 나은 서비스 품질을 제공할 수 있다고 생각합니다.
        앞으로는 이러한 이슈를 이론으로만 이해하지 않고, 작은 실험 프로젝트로 직접 검증해보고 싶습니다.
      </p>
    `
    },

    interest: {
        title: "LOAD_AI_NETWORK_PROTOCOL",
        meta: "> loading interest.protocol",
        body: `
      <p>
        제가 관심을 가지고 있는 분야는 인공지능, 컴퓨터 네트워크, 클라우드 인프라,
        트래픽 분석, 데이터 전송 최적화입니다.
        특히 AI 모델을 단순히 사용하는 것에서 끝나는 것이 아니라,
        실제 서비스 환경에서 사용자에게 안정적으로 제공하는 과정에 관심이 있습니다.
      </p>
      <ul>
        <li>Artificial Intelligence: 머신러닝, 딥러닝, LLM 활용</li>
        <li>AI Service: AI 모델을 실제 서비스 문제에 적용하는 구조</li>
        <li>Computer Network: HTTP, TCP/IP, 라우팅, 지연 시간</li>
        <li>Cloud Infrastructure: 서비스 배포와 운영 환경</li>
        <li>Traffic Optimization: 데이터 전송 한계, 경로 선택, 품질 개선</li>
      </ul>
      <p>
        진로는 학석사 연계 네트워크 연구실에서 기반 역량을 강화한 뒤,
        AI 서비스 기업 또는 연구 조직에서 네트워크 기반 AI 서비스 개발로 확장하는 방향을 생각하고 있습니다.
      </p>
    `
    },

    competency: {
        title: "BUILD_JOB_COMPETENCY",
        meta: "> compiling competency.stack",
        body: `
      <p>
        저의 직무 역량은 새로운 기술을 배우고 실제 코드로 구현해보려는 태도에서 나온다고 생각합니다.
        AI, 백엔드, 네트워크 등 다양한 분야를 학습하면서 개념을 이해하는 데 그치지 않고,
        직접 프로그램을 만들어보며 동작 원리를 확인하려고 노력하고 있습니다.
      </p>
      <p>
        또한 문제가 발생했을 때 오류 메시지를 분석하고, 원인을 찾고,
        해결 방법을 정리하는 과정을 통해 개발자로서의 기본기를 쌓아가고 있습니다.
        앞으로는 이러한 역량을 바탕으로 AI와 네트워크를 연결하는 분야에서 더 깊이 있는 개발 경험을 쌓고 싶습니다.
        특히 문제를 발견하는 능력뿐 아니라 재발을 막는 구조적 개선 능력을 함께 키우는 것을 중요하게 생각합니다.
      </p>
    `
    },

    lab: {
        title: "CONNECT_TO_NETWORK_LAB",
        meta: "> connection request sent: network_lab",
        body: `
      <p>
        네트워크는 클라우드, 모바일 서비스, AI 서비스까지 다양한 기술의 기반이 됩니다.
        저는 이러한 기반 기술을 깊이 이해하고 싶어 학석사 연계를 통해 네트워크 연구실에서 공부를 이어가고 싶습니다.
      </p>
      <p>
        저에게 네트워크 연구실은 최종 목적지가 아니라 AI 분야로 나아가기 위한 중요한 경로입니다.
        연구실에서 네트워크 구조와 프로토콜, 트래픽 분석 등을 공부하고,
        이를 바탕으로 AI로 더 나은 서비스를 개발하는 역량과 연결하고 싶습니다.
      </p>
      <p>
        중장기적으로는 공모전, 인턴십, 연구 프로젝트를 병행하면서
        네트워크와 AI를 함께 다루는 실전 경험을 쌓는 것이 목표입니다.
      </p>
    `
    }
};

function openMission(type, element) {
    const data = missionData[type];
    const missionView = document.getElementById("missionView");
    const buttons = document.querySelectorAll(".mission-btn");

    buttons.forEach(button => button.classList.remove("active"));
    element.classList.add("active");

    missionView.innerHTML = `
    <h3>${data.title}</h3>
    <div class="mission-meta">${data.meta}</div>
    ${data.body}
  `;
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
window.addEventListener("load", onScroll);

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
