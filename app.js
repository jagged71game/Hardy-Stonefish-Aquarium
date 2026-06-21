const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  player: "",
  actualCount: 0,
  displayCount: 0,
  mood: 62,
  hunger: 72,
  hygiene: 90,
  health: 100,
  glass: 100,
  poop: 0,
  poopItems: [],
  sick: false,
  gameOver: false,
  endReason: null,
  ticks: 0,
  day: 1,
  sound: true,
  fish: []
};

const remarks = {
  idle: [
    "They are doing absolutely nothing.",
    "One moved. Probably a rendering error.",
    "A thriving ecosystem of expensive rocks.",
    "The smallest one is somehow in charge.",
    "Their thoughts remain pleasingly sedimentary."
  ],
  feed: [
    "Quartz accepted. Gratitude not detected.",
    "They have eaten the bait and ignored the trap.",
    "A feeding frenzy, by geological standards.",
    "One has claimed the quartz for tax purposes."
  ],
  play: [
    "A rubber ball is introduced. It is mistaken for geology.",
    "They played hide and seek. The rocks won.",
    "One fish moved nearly a centimetre.",
    "The shoal enjoyed this without visible evidence."
  ],
  clean: [
    "The gravel is clean. Nobody admits responsibility.",
    "Waste removed. The water is merely suspicious again.",
    "Aquarium hygiene restored to regulatory fiction.",
    "The poop scoop has seen things."
  ],
  medicine: [
    "Medicine administered. It tasted faintly of quartz.",
    "The patients resent being distinguishable from rocks.",
    "Treatment complete. Prognosis: extremely Hardy.",
    "A tiny underwater insurance claim has been filed."
  ],
  polish: [
    "Scales polished. Camouflage compromised.",
    "They gleam with unwanted collectability.",
    "A premium finish on a profoundly non-premium fish.",
    "The barnacles have filed a complaint."
  ],
  provoke: [
    "A terrible idea begins to gather momentum.",
    "The nearest boulder appears offended.",
    "You have activated the skull.",
    "Sarl Mudfoot would advise against this. If available."
  ]
};

const clamp = (value) => Math.max(0, Math.min(100, value));

function hashName(name) {
  return [...name].reduce((n, char) => ((n << 5) - n + char.charCodeAt(0)) | 0, 0);
}

async function getHardyCount(player) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const requestOptions = {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" }
    };
    const encodedPlayer = encodeURIComponent(player.trim().toLowerCase());
    const [detailsPrimary, detailsFallback, ...collectionResults] = await Promise.allSettled([
      fetch(`https://api2.splinterlands.com/cards/get_details?t=${Date.now()}`, requestOptions),
      fetch(`https://api.splinterlands.io/cards/get_details?t=${Date.now()}`, requestOptions),
      fetch(`https://api2.splinterlands.com/cards/collection/${encodedPlayer}?t=${Date.now()}`, requestOptions),
      fetch(`https://api.splinterlands.io/cards/collection/${encodedPlayer}?t=${Date.now()}`, requestOptions)
    ]);

    let detailsPayload;
    for (const result of [detailsPrimary, detailsFallback]) {
      if (result.status === "fulfilled" && result.value.ok) {
        try {
          detailsPayload = await result.value.json();
          break;
        } catch {
          // Try the other official card catalogue.
        }
    }
    }
    if (!detailsPayload) throw new Error("The card catalogue did not answer.");

    const details = findCardArray(detailsPayload);
    const hardy = details.find((card) => normalizeName(card.name || card.card_name) === "hardy stonefish");
    if (!hardy) throw new Error("Hardy Stonefish has achieved perfect camouflage.");

    const hardyIds = new Set([
      hardy.id,
      hardy.card_detail_id,
      hardy.cardDetailId
    ].filter((value) => value !== undefined && value !== null).map(String));

    const counts = [];
    for (const result of collectionResults) {
      if (result.status !== "fulfilled" || !result.value.ok) continue;
      try {
        const payload = await result.value.json();
        const cards = findCardArray(payload);
        if (!cards.length) {
          counts.push(0);
          continue;
        }
        counts.push(cards.reduce((sum, card) => {
          const nested = card.card_detail || card.cardDetails || card.details || {};
          const cardId = card.card_detail_id ?? card.cardDetailId ?? nested.id ?? card.id;
          const cardName = card.name ?? card.card_name ?? nested.name;
          const isHardy = hardyIds.has(String(cardId)) || normalizeName(cardName) === "hardy stonefish";
          if (!isHardy) return sum;
          const quantity = Number(card.qty ?? card.quantity ?? card.count ?? card.num_cards ?? 1);
          return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
        }, 0));
      } catch {
        // One API format failed to parse; another successful official response can still be used.
      }
    }

    if (!counts.length) throw new Error("The collection service was blocked by this browser.");
    return Math.max(...counts);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findCardArray(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.cards,
    payload?.collection,
    payload?.data,
    payload?.result,
    payload?.items,
    payload?.data?.cards,
    payload?.result?.cards,
    payload?.collection?.cards
  ];
  return candidates.find(Array.isArray) || [];
}

function setStatus(message, isError = false) {
  $("#lookupStatus").textContent = message;
  $("#lookupStatus").classList.toggle("error", isError);
}

function randomRemark(type) {
  const options = remarks[type];
  return options[Math.floor(Math.random() * options.length)];
}

function makeBubbles() {
  const layer = $("#bubbleLayer");
  for (let i = 0; i < 26; i++) {
    const bubble = document.createElement("i");
    bubble.className = "bubble";
    bubble.style.cssText = `left:${Math.random() * 100}%;--size:${4 + Math.random() * 15}px;--speed:${5 + Math.random() * 9}s;--delay:${-Math.random() * 14}s`;
    layer.appendChild(bubble);
  }
}

function makeFish(count, seed) {
  const layer = $("#fishLayer");
  layer.innerHTML = "";
  state.fish = [];
  const visible = Math.min(count, 60);
  const rng = mulberry32(Math.abs(seed) || 1);
  for (let i = 0; i < visible; i++) {
    const fish = $("#fishTemplate").content.firstElementChild.cloneNode(true);
    const scale = .34 + rng() * .46;
    const temperamentRoll = rng();
    const temperament = temperamentRoll < .28
      ? "rock"
      : temperamentRoll < .53
        ? "bottom"
        : temperamentRoll < .73
          ? "vertical"
          : temperamentRoll < .91
            ? "drifter"
            : "active";
    const nearBottom = temperament === "rock" || temperament === "bottom";
    const bottom = nearBottom
      ? 36 + rng() * 42
      : 42 + rng() * Math.max(60, $("#tank").clientHeight - 165);
    const left = 2 + rng() * 84;
    const bobTime = temperament === "rock" ? 40 : temperament === "bottom" ? 15 + rng() * 12 : 3 + rng() * 6;
    const swimTime = temperament === "active" ? 5 + rng() * 5 : 9 + rng() * 10;
    fish.style.cssText = `left:${left}%;bottom:${bottom}px;--scale:${scale};--bob:${bobTime}s;--swim-time:${swimTime}s;--facing:${rng() > .5 ? 1 : -1};animation-delay:${-rng() * 5}s`;
    fish.dataset.left = left;
    fish.dataset.bottom = bottom;
    fish.dataset.homeBottom = bottom;
    fish.dataset.temperament = temperament;
    fish.dataset.patience = Math.floor(rng() * 5);
    fish.dataset.metabolism = (.45 + rng() * 1.25).toFixed(2);
    fish.dataset.digestion = (rng() * 35).toFixed(1);
    fish.dataset.wasteType = rng() < .18 ? "pebbles" : rng() < .38 ? "ribbon" : rng() < .5 ? "cloud" : "classic";
    fish.classList.add(`fish-${temperament}`);
    fish.title = `${{
      rock: "This one has committed fully to being a rock.",
      bottom: "A dedicated bottom-sitter.",
      vertical: "This one prefers elevators to travel.",
      drifter: "A leisurely drifting boulder.",
      active: "Suspiciously energetic."
    }[temperament]} Metabolism: ${Number(fish.dataset.metabolism) > 1.25 ? "alarming" : Number(fish.dataset.metabolism) < .7 ? "glacial" : "ordinary"}.`;
    fish.style.zIndex = String(4 + Math.floor((1000 - bottom) / 120));
    fish.addEventListener("click", () => petFish(fish));
    layer.appendChild(fish);
    state.fish.push(fish);
  }
}

function wanderFish() {
  if ($("#gamePanel").classList.contains("hidden") || state.gameOver) return;
  const tankHeight = $("#tank").clientHeight;
  state.fish.forEach((fish) => {
    if (fish.classList.contains("slam")) return;
    const temperament = fish.dataset.temperament;
    const patience = Number(fish.dataset.patience || 0);
    if (patience > 0) {
      fish.dataset.patience = patience - 1;
      return;
    }
    const moveChance = {
      rock: .015,
      bottom: .12,
      vertical: .42,
      drifter: .48,
      active: .82
    }[temperament];
    if (Math.random() > moveChance) return;

    const oldLeft = Number(fish.dataset.left);
    const oldBottom = Number(fish.dataset.bottom);
    let newLeft = oldLeft;
    let newBottom = oldBottom;

    if (temperament === "rock") {
      newLeft = Math.max(1, Math.min(84, oldLeft + (Math.random() - .5) * 5));
      newBottom = 36 + Math.random() * 35;
      fish.dataset.patience = 15 + Math.floor(Math.random() * 30);
    } else if (temperament === "bottom") {
      newLeft = Math.max(1, Math.min(84, oldLeft + (Math.random() - .5) * 18));
      newBottom = 36 + Math.random() * 46;
      fish.dataset.patience = 4 + Math.floor(Math.random() * 9);
    } else if (temperament === "vertical") {
      newLeft = Math.max(1, Math.min(84, oldLeft + (Math.random() - .5) * 5));
      newBottom = Math.max(42, Math.min(tankHeight - 150, oldBottom + (Math.random() - .5) * 190));
      fish.dataset.patience = 1 + Math.floor(Math.random() * 4);
    } else {
      const distance = temperament === "active" ? 15 + Math.random() * 28 : 7 + Math.random() * 18;
      newLeft = Math.max(1, Math.min(84, oldLeft + distance * (Math.random() > .5 ? 1 : -1)));
      const verticalRange = temperament === "active" ? 140 : 80;
      newBottom = Math.max(42, Math.min(tankHeight - 150, oldBottom + (Math.random() - .5) * verticalRange));
      fish.dataset.patience = temperament === "active" ? 0 : 1 + Math.floor(Math.random() * 3);
    }

    fish.dataset.left = newLeft;
    fish.dataset.bottom = newBottom;
    if (Math.abs(newLeft - oldLeft) > 1) fish.style.setProperty("--facing", newLeft > oldLeft ? -1 : 1);
    const swimSeconds = temperament === "active"
      ? 5 + Math.random() * 5
      : temperament === "rock"
        ? 18 + Math.random() * 14
        : 9 + Math.random() * 10;
    fish.style.setProperty("--swim-time", `${swimSeconds}s`);
    fish.style.left = `${newLeft}%`;
    fish.style.bottom = `${newBottom}px`;
  });
}

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function petFish(fish) {
  fish.classList.add("happy");
  state.mood = clamp(state.mood + 2);
  showMessage("You patted a rock. It tolerated this.");
  updateMeters();
  blip(220, .04);
  setTimeout(() => fish.classList.remove("happy"), 900);
}

function showMessage(message) {
  $("#tankMessage").textContent = message;
}

function renderPoop() {
  const layer = $("#wasteLayer");
  layer.innerHTML = "";
  state.poopItems.slice(-24).forEach((item) => {
    const waste = document.createElement("i");
    waste.className = `poop poop-${item.type}${item.age > 7 ? " poop-old" : ""}`;
    waste.style.cssText = `left:${item.left}%;bottom:${item.bottom}px;--poop-size:${item.size};--poop-turn:${item.turn}deg;--poop-hue:${item.hue}deg;--poop-opacity:${Math.max(.35, 1 - item.age * .045)}`;
    waste.title = `${item.type} waste · ${item.age > 7 ? "breaking down into murk" : "freshly deposited"}`;
    layer.appendChild(waste);
  });
  state.poop = state.poopItems.length;
}

function depositWaste(fish, forced = false) {
  if (state.poopItems.length >= 30) return;
  const metabolism = Number(fish.dataset.metabolism || 1);
  const type = fish.dataset.wasteType || "classic";
  const sizeBase = type === "pebbles" ? .65 : type === "cloud" ? 1.25 : .85;
  const size = Math.max(.5, Math.min(1.65, sizeBase * (.75 + metabolism * .35) * (.8 + Math.random() * .4)));
  state.poopItems.push({
    id: `${Date.now()}-${Math.random()}`,
    type,
    size: size.toFixed(2),
    left: Math.max(3, Math.min(94, Number(fish.dataset.left) + (Math.random() - .5) * 8)).toFixed(1),
    bottom: Math.round(37 + Math.random() * 20),
    turn: Math.round((Math.random() - .5) * 70),
    hue: Math.round((metabolism - 1) * 22 + (Math.random() - .5) * 12),
    age: 0,
    potency: forced ? 1.25 : .65 + metabolism * .5
  });
}

function digestFish(extraFood = 0) {
  state.fish.forEach((fish) => {
    const metabolism = Number(fish.dataset.metabolism || 1);
    let digestion = Number(fish.dataset.digestion || 0) + metabolism * (5 + extraFood);
    while (digestion >= 100) {
      depositWaste(fish, extraFood > 0);
      digestion -= 100;
    }
    fish.dataset.digestion = digestion.toFixed(1);
  });
  state.poopItems.forEach((item) => { item.age++; });
  state.poop = state.poopItems.length;
}

function wasteLoad() {
  return state.poopItems.reduce((sum, item) => {
    const decayMultiplier = item.age > 7 ? 1.7 : item.age > 3 ? 1.25 : 1;
    const typeMultiplier = item.type === "cloud" ? 1.55 : item.type === "ribbon" ? 1.2 : .9;
    return sum + Number(item.potency || 1) * decayMultiplier * typeMultiplier;
  }, 0);
}

function evaluateHealth() {
  if (state.hunger < 25 || state.hygiene < 28) state.sick = true;
  if (state.sick) state.health = clamp(state.health - 3);
  else if (state.hunger > 55 && state.hygiene > 60) state.health = clamp(state.health + 2);
  if (state.health <= 0 && !state.gameOver) endGame("death");
}

function updateMeters() {
  $("#moodMeter").style.width = `${state.mood}%`;
  $("#hungerMeter").style.width = `${state.hunger}%`;
  $("#hygieneMeter").style.width = `${state.hygiene}%`;
  $("#healthMeter").style.width = `${state.health}%`;
  $("#glassMeter").style.width = `${state.glass}%`;
  const dockValues = {
    Mood: state.mood,
    Hunger: state.hunger,
    Hygiene: state.hygiene,
    Health: state.health
  };
  Object.entries(dockValues).forEach(([name, value]) => {
    $(`#dock${name}`).style.setProperty("--value", `${value}%`);
    $(`#dock${name}Value`).textContent = Math.round(value);
  });
  $("#moodLabel").textContent = state.mood > 78 ? "almost pleased" : state.mood > 48 ? "stony" : "miserable";
  $("#hungerLabel").textContent = state.hunger > 75 ? "well fed" : state.hunger > 35 ? "peckish" : "starving";
  const hygieneWord = state.hygiene > 75 ? "sparkling" : state.hygiene > 35 ? "questionable" : "biohazard";
  $("#hygieneLabel").textContent = state.poop ? `${hygieneWord} · ${state.poop} deposits` : hygieneWord;
  $("#healthLabel").textContent = state.health > 75 ? "hardy" : state.health > 35 ? "unwell" : "very poorly";
  $("#glassLabel").textContent = state.glass > 70 ? "pristine" : state.glass > 35 ? "nervous" : "condemned";
  $("#glassCracks").style.opacity = Math.max(0, (75 - state.glass) / 55);
  const hiddenCount = Math.round(state.fish.length * Math.max(0, 55 - state.mood) / 130);
  state.fish.forEach((fish, index) => {
    fish.classList.toggle("hidden-fish", index < hiddenCount);
    fish.classList.toggle("sick", !state.gameOver && state.sick && index % 3 === 0);
  });
  renderPoop();
  saveGame();
}

function writeLog(text) {
  state.day++;
  $("#dayCounter").textContent = `DAY ${state.day}`;
  $("#logText").textContent = text;
}

function saveGame() {
  if (!state.player) return;
  localStorage.setItem(`hardy-aquarium:${state.player.toLowerCase()}`, JSON.stringify({
    mood: state.mood,
    hunger: state.hunger,
    hygiene: state.hygiene,
    health: state.health,
    glass: state.glass,
    poop: state.poop,
    poopItems: state.poopItems,
    sick: state.sick,
    gameOver: state.gameOver,
    endReason: state.endReason,
    ticks: state.ticks,
    day: state.day,
    savedAt: Date.now()
  }));
}

function loadGame(player) {
  try {
    const saved = JSON.parse(localStorage.getItem(`hardy-aquarium:${player.toLowerCase()}`));
    if (!saved) return false;
    Object.assign(state, saved);
    if (!Array.isArray(state.poopItems)) {
      state.poopItems = Array.from({ length: Math.min(saved.poop || 0, 18) }, (_, index) => ({
        id: `legacy-${index}`,
        type: "classic",
        size: 1,
        left: 5 + ((hashName(player) + index * 37) % 88 + 88) % 88,
        bottom: 42,
        turn: (index % 5 - 2) * 7,
        hue: 0,
        age: 3,
        potency: 1
      }));
    }
    const elapsedTicks = Math.min(24, Math.floor((Date.now() - saved.savedAt) / 15000));
    state.hunger = clamp(state.hunger - elapsedTicks * 2);
    state.hygiene = clamp(state.hygiene - elapsedTicks);
    state.mood = clamp(state.mood - elapsedTicks);
    for (let tick = 0; tick < elapsedTicks; tick++) {
      if (tick % 4 === 0 && state.fish.length) depositWaste(state.fish[tick % state.fish.length]);
      state.poopItems.forEach((item) => { item.age++; });
    }
    state.poop = state.poopItems.length;
    evaluateHealth();
    return true;
  } catch {
    return false;
  }
}

function animateHappy() {
  state.fish.forEach((fish, index) => setTimeout(() => {
    fish.classList.add("happy");
    setTimeout(() => fish.classList.remove("happy"), 850);
  }, index * 20));
}

function act(type) {
  if (state.gameOver) return;
  let message = randomRemark(type);

  if (type === "feed") {
    const wasFull = state.hunger > 88;
    state.mood = clamp(state.mood + 10);
    state.hunger = clamp(state.hunger + 30);
    animateHappy();
    blip(330, .06);
    setTimeout(() => {
      digestFish(wasFull ? 58 : 34);
      state.hygiene = clamp(state.hygiene - (wasFull ? 8 : 3));
      if (wasFull) state.health = clamp(state.health - 4);
      showMessage(wasFull
        ? "You overfed them. The biological consequences are immediate and diverse."
        : "Several unique digestive journeys have concluded.");
      updateMeters();
    }, 1800);
  }

  if (type === "play") {
    state.mood = clamp(state.mood + 22);
    state.hunger = clamp(state.hunger - 4);
    animateHappy();
    blip(440, .08);
  }

  if (type === "clean") {
    if (!state.poop && state.hygiene > 90) message = "You cleaned an already clean tank. Admirably anxious.";
    state.poop = 0;
    state.poopItems = [];
    state.hygiene = clamp(state.hygiene + 42);
    blip(620, .08);
  }

  if (type === "medicine") {
    if (!state.sick) {
      message = "They are not sick. The medicine returns to the tiny cabinet.";
    } else if (state.hygiene < 35 || state.hunger < 25) {
      message = "Medicine cannot defeat a filthy, empty tank. Feed and clean first.";
    } else {
      state.sick = false;
      state.health = clamp(state.health + 38);
      state.mood = clamp(state.mood - 4);
      blip(760, .1);
    }
  }

  if (type === "polish") {
    state.mood = clamp(state.mood - 3);
    state.hygiene = clamp(state.hygiene + 8);
    blip(540, .05);
  }

  if (type === "provoke") {
    state.mood = clamp(state.mood - 17);
    const attacker = state.fish[Math.floor(Math.random() * state.fish.length)];
    if (attacker) {
      attacker.classList.add("slam");
      setTimeout(() => attacker.classList.remove("slam"), 650);
    }
    const damage = 7 + Math.floor(Math.random() * 17);
    setTimeout(() => {
      state.glass = clamp(state.glass - damage);
      thud();
      if (state.glass === 0) {
        endGame("breach");
      }
      updateMeters();
    }, 350);
  }

  showMessage(message);
  writeLog(message);
  updateMeters();
}

function endGame(reason = "breach") {
  state.gameOver = true;
  state.endReason = reason;
  presentEnding(reason, true);
  saveGame();
}

function presentEnding(reason, writeEndingLog = false) {
  const death = reason === "death";
  $("#gameOverEyebrow").textContent = death ? "A MOMENT OF STONY SILENCE" : "CATASTROPHIC HUSBANDRY EVENT";
  $("#gameOverTitle").textContent = death ? "The shoal has passed." : "Aquarium breached.";
  $("#gameOverText").textContent = death
    ? "Their final act was to become completely indistinguishable from ordinary rocks."
    : "The Hardy Stonefish are free. Your carpet is not expected to survive.";
  $("#restartGame").textContent = death ? "Start a new shoal" : "Replace aquarium";
  showMessage(death ? "No vital signs. Admittedly, there were never many." : "TANK BREACHED. Sarl Mudfoot sends his regards.");
  if (writeEndingLog) {
    writeLog(death
      ? "The aquarium has become a memorial garden. Hygiene reports will be sealed."
      : "The aquarium is now a floor feature. The Hardy Stonefish remain untroubled.");
  }
  $("#gameOver").classList.remove("hidden");
  $$("[data-action]").forEach((button) => { button.disabled = true; });
  state.fish.forEach((fish) => {
    if (death) {
      fish.classList.remove("sick", "happy");
      fish.classList.add("deceased");
      fish.style.transitionDuration = "4s";
      fish.style.bottom = `${36 + Math.random() * 35}px`;
    } else {
      fish.style.transitionDuration = ".8s";
      fish.style.bottom = "-180px";
    }
  });
}

function resetTank() {
  localStorage.removeItem(`hardy-aquarium:${state.player.toLowerCase()}`);
  const player = state.player;
  const count = state.actualCount;
  $("#gameOver").classList.add("hidden");
  $$("[data-action]").forEach((button) => { button.disabled = false; });
  enterTank(player, count, "restart");
  showMessage("A replacement aquarium has been invoiced to the keeper.");
  $("#logText").textContent = "Day one, again. The Stonefish deny all involvement in the previous tank.";
}

function blip(frequency, duration) {
  if (!state.sound) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

function thud() {
  if (!state.sound) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(85, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(34, ctx.currentTime + .22);
  gain.gain.setValueAtTime(.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .25);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + .26);
}

function enterTank(player, count, source = "live") {
  Object.assign(state, {
    player,
    actualCount: count,
    displayCount: Math.max(1, count),
    mood: 62,
    hunger: 72,
    hygiene: 90,
    health: 100,
    glass: 100,
    poop: 0,
    poopItems: [],
    sick: false,
    gameOver: false,
    endReason: null,
    ticks: 0,
    day: 1
  });
  $("#keeperName").textContent = player;
  $("#fishCount").textContent = count.toLocaleString();
  $("#dayCounter").textContent = "DAY 1";
  $("#loginPanel").classList.add("hidden");
  $("#gamePanel").classList.remove("hidden");
  makeFish(state.displayCount, hashName(player));
  const returning = loadGame(player);
  updateMeters();
  $("#gameOver").classList.toggle("hidden", !state.gameOver);
  $$("[data-action]").forEach((button) => { button.disabled = state.gameOver; });
  if (state.gameOver) presentEnding(state.endReason || (state.glass <= 0 ? "breach" : "death"));
  showMessage(count
    ? `${Math.min(count, 60)} specimens visible. ${count > 60 ? "The rest are hiding for performance reasons." : "They are doing absolutely nothing."}`
    : "No Hardy Stonefish found. A pity specimen has been issued.");
  $("#logText").textContent = returning
    ? "The keeper has returned. The fish remember everything and forgive nothing."
    : source === "live"
      ? `Collection verified. ${count || "Zero"} Hardy Stonefish reported for duty.`
      : "This is a demonstration shoal. Their qualifications are fabricated.";
}

$("#playerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const player = $("#playerName").value.trim();
  if (!player) return;
  const submit = event.currentTarget.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = "Dredging…";
  setStatus("Searching the silt trail…");
  try {
    const count = await getHardyCount(player);
    enterTank(player, count);
  } catch (error) {
    setStatus(`${error.message || "Lookup failed"} Try the demo tank for now.`, true);
  } finally {
    submit.disabled = false;
    submit.textContent = "Fill the tank";
  }
});

$("#demoButton").addEventListener("click", () => enterTank("Sarl_Mudfoot", 37, "demo"));
$("#changeKeeper").addEventListener("click", () => {
  $("#gamePanel").classList.add("hidden");
  $("#loginPanel").classList.remove("hidden");
  setStatus("Live collection lookup · no login required");
});
$("#soundButton").addEventListener("click", (event) => {
  state.sound = !state.sound;
  event.currentTarget.textContent = `sound: ${state.sound ? "on" : "off"}`;
});
$("#restartGame").addEventListener("click", resetTank);
$("#dockToggle").addEventListener("click", () => {
  const open = !$("#watchDock").classList.contains("open");
  $("#watchDock").classList.toggle("open", open);
  $("#dockToggle").setAttribute("aria-expanded", String(open));
  $("#dockPanel").setAttribute("aria-hidden", String(!open));
});

async function enterWatchMode() {
  document.body.classList.add("watch-mode");
  $("#watchDock").classList.remove("open");
  $("#dockToggle").setAttribute("aria-expanded", "false");
  $("#dockPanel").setAttribute("aria-hidden", "true");
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // The immersive layout still works when a browser declines native full screen.
  }
}

async function exitWatchMode() {
  document.body.classList.remove("watch-mode");
  $("#watchDock").classList.remove("open");
  $("#dockToggle").setAttribute("aria-expanded", "false");
  $("#dockPanel").setAttribute("aria-hidden", "true");
  try {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
  } catch {
    // Leaving the immersive layout is sufficient if native full screen has already ended.
  }
}

$("#watchModeButton").addEventListener("click", enterWatchMode);
$("#exitWatchMode").addEventListener("click", exitWatchMode);
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) document.body.classList.remove("watch-mode");
});
$$("[data-action]").forEach((button) => button.addEventListener("click", () => act(button.dataset.action)));

makeBubbles();
setInterval(wanderFish, 4800);
setInterval(() => {
  if ($("#gamePanel").classList.contains("hidden") || state.gameOver) return;
  state.ticks++;
  state.hunger = clamp(state.hunger - 2);
  state.mood = clamp(state.mood - (state.sick ? 2 : 1));
  digestFish(0);
  const pollution = wasteLoad();
  state.hygiene = clamp(state.hygiene - Math.max(.5, pollution / 7));
  evaluateHealth();
  if (state.gameOver) return;
  showMessage(state.sick
    ? "Some of the rocks look green. Greener than usual."
    : pollution > 15
      ? "The substrate has become politically indefensible."
      : state.poopItems.some((item) => item.age > 7)
        ? "Old waste is dissolving into a fascinating and medically relevant haze."
      : randomRemark("idle"));
  updateMeters();
}, 15000);
