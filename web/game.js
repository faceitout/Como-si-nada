"use strict";

const GAME_DATA_PATH = "data/game.json";
const MUSIC_SRC = "assets/music/Crossy Road Castle OST - 09 Let's Bounce (Construction Remix) - Crossy Road.mp3";

const app = document.querySelector("#gameApp");
const modalRoot = document.querySelector("#modalRoot");

let gameData = null;
let scenes = new Map();
let currentSceneId = null;
let selectedOptionIndex = null;
let modalOpen = false;
let currentFinalSlideIndex = 0;

let activeTextTimeline = null;
let activeSceneTimeline = null;
let isTransitioning = false;

let backgroundMusic = null;
let isMusicMuted = false;

async function initGame() {
  try {
    initCustomCursor();
    initBackgroundMusic();

    const response = await fetch(GAME_DATA_PATH);

    if (!response.ok) {
      throw new Error("No se pudo cargar data/game.json");
    }

    gameData = await response.json();
    scenes = new Map(gameData.scenes.map((scene) => [scene.id, scene]));
    currentSceneId = gameData.startScene;

    preloadImages();
    renderScene();

    app.addEventListener("click", handleGameClick);
    modalRoot.addEventListener("click", handleModalClick);
  } catch (error) {
    console.error(error);

    app.innerHTML = `
      <section class="stage is-error">
        <div class="scene-bg"></div>
        <section class="dialog dialog--narrative">
          <p class="dialog__text">
            Error cargando el juego. Revisa que exista data/game.json y que estés usando Live Server.
          </p>
        </section>
      </section>
    `;
  }
}

/* =========================
   MÚSICA
========================= */

function initBackgroundMusic() {
  if (backgroundMusic) return;

  backgroundMusic = new Audio(MUSIC_SRC);
  backgroundMusic.loop = true;
  backgroundMusic.preload = "auto";
  backgroundMusic.volume = 0.22;
  backgroundMusic.muted = isMusicMuted;
}

function playBackgroundMusic() {
  if (!backgroundMusic) {
    initBackgroundMusic();
  }

  if (!backgroundMusic || isMusicMuted) {
    return;
  }

  backgroundMusic.play().catch((error) => {
    console.warn("La música no pudo reproducirse todavía:", error);
  });
}

function stopBackgroundMusic() {
  if (!backgroundMusic) return;

  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
}

function toggleMusic() {
  if (!backgroundMusic) {
    initBackgroundMusic();
  }

  isMusicMuted = !isMusicMuted;

  if (backgroundMusic) {
    backgroundMusic.muted = isMusicMuted;

    if (!isMusicMuted) {
      playBackgroundMusic();
    }
  }

  updateMusicButton();
}

function updateMusicButton() {
  const button = app.querySelector("[data-action='toggle-music']");

  if (!button) return;

  button.setAttribute("aria-label", isMusicMuted ? "Activar música" : "Silenciar música");
  button.setAttribute("aria-pressed", String(!isMusicMuted));

  const icon = button.querySelector("[data-music-icon]");

  if (icon) {
    icon.className = `icon icon--sound ${isMusicMuted ? "is-muted" : ""}`;
  }
}

/* =========================
   CURSOR CUSTOM CON GSAP
========================= */

function initCustomCursor() {
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

  if (isTouchDevice || !window.gsap) {
    return;
  }

  const cursor = document.createElement("div");
  cursor.className = "custom-cursor";
  cursor.setAttribute("aria-hidden", "true");
  document.body.appendChild(cursor);

  document.documentElement.classList.add("has-custom-cursor");

  gsap.set(cursor, {
    xPercent: -50,
    yPercent: -50,
    autoAlpha: 0,
    scale: 1
  });

  const moveX = gsap.quickTo(cursor, "x", {
    duration: 0.22,
    ease: "power3.out"
  });

  const moveY = gsap.quickTo(cursor, "y", {
    duration: 0.22,
    ease: "power3.out"
  });

  let cursorVisible = false;

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;

    if (!cursorVisible) {
      cursorVisible = true;

      gsap.to(cursor, {
        autoAlpha: 1,
        duration: 0.15,
        ease: "power2.out"
      });
    }

    moveX(event.clientX);
    moveY(event.clientY);
  });

  document.addEventListener("pointerleave", () => {
    cursorVisible = false;

    gsap.to(cursor, {
      autoAlpha: 0,
      duration: 0.15,
      ease: "power2.out"
    });
  });

  document.addEventListener("pointerdown", () => {
    gsap.to(cursor, {
      scale: 0.75,
      duration: 0.08,
      ease: "power2.out"
    });
  });

  document.addEventListener("pointerup", () => {
    gsap.to(cursor, {
      scale: 1,
      duration: 0.12,
      ease: "power2.out"
    });
  });
}

/* =========================
   ANIMACIÓN TEXTO ESCRIBIÉNDOSE
========================= */

function animateSceneText() {
  if (!canAnimateMotion()) {
    return;
  }

  if (activeTextTimeline) {
    activeTextTimeline.kill();
    activeTextTimeline = null;
  }

  const textElements = Array.from(app.querySelectorAll("[data-typewriter]"));

  if (!textElements.length) {
    return;
  }

  activeTextTimeline = gsap.timeline();

  textElements.forEach((element) => {
    const fullText = element.textContent;

    if (!fullText.trim()) {
      return;
    }

    const originalHeight = element.offsetHeight;
    element.style.minHeight = `${originalHeight}px`;
    element.textContent = "";

    const textNode = document.createTextNode("");
    const caret = document.createElement("span");

    caret.setAttribute("aria-hidden", "true");
    caret.style.display = "inline-block";
    caret.style.width = "0.08em";
    caret.style.height = "1em";
    caret.style.marginLeft = "0.08em";
    caret.style.background = "currentColor";
    caret.style.verticalAlign = "-0.12em";

    element.appendChild(textNode);
    element.appendChild(caret);

    const state = {
      chars: 0
    };

    const duration = getTypewriterDuration(fullText);

    activeTextTimeline.fromTo(
      element,
      {
        autoAlpha: 0,
        y: 4
      },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.16,
        ease: "power2.out"
      },
      ">0.03"
    );

    activeTextTimeline.to(
      state,
      {
        chars: fullText.length,
        duration,
        ease: "none",
        onUpdate: () => {
          const visibleChars = Math.floor(state.chars);
          textNode.nodeValue = fullText.slice(0, visibleChars);
        },
        onComplete: () => {
          textNode.nodeValue = fullText;
          caret.remove();
          element.style.minHeight = "";
        }
      },
      "<0.02"
    );
  });
}

function getTypewriterDuration(text) {
  const baseDuration = text.length * 0.017;
  return Math.min(2.15, Math.max(0.45, baseDuration));
}

/* =========================
   TRANSICIÓN SUAVE SLIDE
========================= */

function canAnimateMotion() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return Boolean(window.gsap) && !reducedMotion;
}

function animateSceneIn() {
  if (!canAnimateMotion()) {
    return;
  }

  const stage = app.querySelector(".stage");

  if (!stage) {
    return;
  }

  if (activeSceneTimeline) {
    activeSceneTimeline.kill();
    activeSceneTimeline = null;
  }

  activeSceneTimeline = gsap.timeline({
    onComplete: () => {
      gsap.set(stage, {
        clearProps: "transform,opacity,visibility"
      });

      activeSceneTimeline = null;
    }
  });

  activeSceneTimeline.fromTo(
    stage,
    {
      autoAlpha: 0,
      xPercent: 8
    },
    {
      autoAlpha: 1,
      xPercent: 0,
      duration: 0.9,
      ease: "power3.out"
    }
  );
}

function renderStageMarkup(scene) {
  return `
    <section
      class="stage is-${escapeAttribute(scene.type)}"
      data-scene-id="${escapeAttribute(scene.id)}"
      tabindex="-1"
    >
      <div
        class="scene-bg"
        style="background-image: url('${escapeAttribute(scene.image)}')"
      ></div>

      ${scene.topBar ? renderTopBar() : ""}
      ${renderSceneContent(scene)}
    </section>
  `;
}

function transitionToScene(sceneId) {
  if (!scenes.has(sceneId)) {
    console.error("No existe la escena:", sceneId);
    return;
  }

  if (isTransitioning) {
    return;
  }

  closeModal();

  const currentStage = app.querySelector(".stage");
  const nextScene = scenes.get(sceneId);

  if (activeTextTimeline) {
    activeTextTimeline.kill();
    activeTextTimeline = null;
  }

  if (activeSceneTimeline) {
    activeSceneTimeline.kill();
    activeSceneTimeline = null;
  }

  if (!canAnimateMotion() || !currentStage) {
    updateSceneState(sceneId);
    renderScene({
      animateIn: false,
      animateText: true
    });
    return;
  }

  isTransitioning = true;

  const currentHeight = currentStage.getBoundingClientRect().height;

  app.style.position = "relative";
  app.style.overflow = "hidden";
  app.style.height = `${currentHeight}px`;

  app.insertAdjacentHTML("beforeend", renderStageMarkup(nextScene));

  const stages = app.querySelectorAll(".stage");
  const nextStage = stages[stages.length - 1];

  if (!nextStage) {
    updateSceneState(sceneId);
    renderScene();
    app.style.position = "";
    app.style.overflow = "";
    app.style.height = "";
    isTransitioning = false;
    return;
  }

  const nextTextElements = nextStage.querySelectorAll("[data-typewriter]");

  gsap.set(currentStage, {
    position: "absolute",
    inset: 0,
    width: "100%",
    zIndex: 1,
    xPercent: 0,
    autoAlpha: 1
  });

  gsap.set(nextStage, {
    position: "absolute",
    inset: 0,
    width: "100%",
    zIndex: 2,
    xPercent: 100,
    autoAlpha: 1
  });

  gsap.set(nextTextElements, {
    autoAlpha: 0
  });

  activeSceneTimeline = gsap.timeline({
    defaults: {
      duration: 1.45,
      ease: "power2.inOut"
    },
    onComplete: () => {
      updateSceneState(sceneId);

      currentStage.remove();

      gsap.set(nextStage, {
        clearProps: "position,inset,width,zIndex,transform,opacity,visibility"
      });

      app.style.position = "";
      app.style.overflow = "";
      app.style.height = "";

      nextStage.focus({ preventScroll: true });

      activeSceneTimeline = null;
      isTransitioning = false;

      animateSceneText();
    }
  });

  activeSceneTimeline
    .to(
      currentStage,
      {
        xPercent: -100
      },
      0
    )
    .to(
      nextStage,
      {
        xPercent: 0
      },
      0
    );
}

function updateSceneState(sceneId) {
  currentSceneId = sceneId;
  selectedOptionIndex = null;
  currentFinalSlideIndex = 0;
}

/* =========================
   JUEGO
========================= */

function preloadImages() {
  const imagePaths = [
    ...new Set(
      gameData.scenes
        .map((scene) => scene.image)
        .filter(Boolean)
    )
  ];

  imagePaths.forEach((src) => {
    const image = new Image();
    image.src = src;
  });
}

function getCurrentScene() {
  return scenes.get(currentSceneId);
}

function renderScene({ animateIn = true, animateText = true } = {}) {
  const scene = getCurrentScene();

  if (!scene) {
    console.error("Escena no encontrada:", currentSceneId);
    return;
  }

  app.innerHTML = renderStageMarkup(scene);

  const stage = app.querySelector(".stage");

  if (stage) {
    stage.focus({ preventScroll: true });
  }

  requestAnimationFrame(() => {
    if (animateIn) {
      animateSceneIn();
    }

    if (animateText) {
      animateSceneText();
    }

    updateMusicButton();
  });
}

function renderSceneContent(scene) {
  if (scene.type === "start") {
    return renderStartScene(scene);
  }

  if (scene.type === "narrative") {
    return renderNarrativeScene(scene);
  }

  if (scene.type === "choice") {
    return renderChoiceScene(scene);
  }

  if (scene.type === "fail") {
    return renderEndScene(scene);
  }

  if (scene.type === "final") {
    return renderFinalSequenceScene(scene);
  }

  return "";
}

function renderStartScene(scene) {
  return `
    <section class="start-card" aria-labelledby="startTitle">
      <h1 id="startTitle" class="start-card__title" data-typewriter>${escapeHtml(scene.title)}</h1>

      <p class="start-card__subtitle" data-typewriter>${escapeHtml(scene.subtitle)}</p>

      <div class="start-card__divider" aria-hidden="true"></div>

      <p class="start-card__description" data-typewriter>${escapeHtml(scene.bodyText)}</p>

      <button class="start-card__play" type="button" data-action="start">
        <span class="start-card__play-label">EMPEZAR A JUGAR</span>
        <span class="play-circle" aria-hidden="true"></span>
      </button>

      <button class="start-card__instructions" type="button" data-action="instructions">
        INSTRUCCIONES
      </button>
    </section>
  `;
}

function renderTopBar() {
  return `
    <nav class="top-bar" aria-label="Controles del juego">
      <button class="top-bar__restart" type="button" data-action="restart">
        VOLVER A EMPEZAR
      </button>

      <button class="top-bar__icon top-bar__music" type="button" data-action="toggle-music" aria-label="${isMusicMuted ? "Activar música" : "Silenciar música"}" aria-pressed="${String(!isMusicMuted)}">
        <span class="icon icon--sound ${isMusicMuted ? "is-muted" : ""}" data-music-icon aria-hidden="true"></span>
      </button>

      <button class="top-bar__icon" type="button" data-action="pause" aria-label="Pausar juego">
        <span class="icon icon--pause" aria-hidden="true"></span>
      </button>

      <button class="top-bar__icon" type="button" data-action="exit" aria-label="Salir al inicio">
        <span class="icon icon--close" aria-hidden="true"></span>
      </button>
    </nav>
  `;
}

function renderNarrativeScene(scene) {
  return `
    <section class="dialog dialog--narrative" aria-label="Texto narrativo">
      <p class="dialog__text" data-typewriter>${escapeHtml(scene.bodyText)}</p>

      <button
        class="dialog__arrow"
        type="button"
        data-action="next"
        aria-label="Avanzar"
      ></button>
    </section>
  `;
}

function renderChoiceScene(scene) {
  const optionsHtml = scene.options
    .map((option, index) => {
      return `
        <button
          class="choice-option"
          type="button"
          data-option-index="${index}"
        >
          <span class="choice-option__number">${index + 1}.</span>
          <span>${escapeHtml(option.label)}</span>
        </button>
      `;
    })
    .join("");

  return `
    <section class="dialog dialog--choice" aria-label="Decisión">
      <p class="dialog__text" data-typewriter>${escapeHtml(scene.bodyText)}</p>

      <div class="dialog__choices">
        ${optionsHtml}
      </div>

      <button
        class="dialog__arrow"
        type="button"
        data-action="confirm-choice"
        aria-label="Confirmar opción"
      ></button>
    </section>
  `;
}

function renderEndScene(scene) {
  const buttonText = scene.buttonText || "VOLVER A JUGAR";

  return `
    <section class="end-card" aria-labelledby="endTitle">
      <h2 id="endTitle" class="end-card__title" data-typewriter>${escapeHtml(scene.title)}</h2>

      <div class="end-card__divider" aria-hidden="true"></div>

      <p class="end-card__body" data-typewriter>${escapeHtml(scene.bodyText)}</p>

      <button class="end-card__button" type="button" data-action="restart">
        <span class="end-card__button-label">${escapeHtml(buttonText)}</span>
        <span class="play-circle" aria-hidden="true"></span>
      </button>
    </section>
  `;
}

function renderFinalSequenceScene(scene) {
  const slides = Array.isArray(scene.slides) ? scene.slides : [];
  const totalSlides = slides.length;
  const safeIndex = Math.max(0, Math.min(currentFinalSlideIndex, totalSlides - 1));
  const slide = slides[safeIndex] || {};

  const headlineBlocks = (slide.headlineBlocks || [])
    .map((block) => {
      return `
        <p class="final-sequence__headline" data-typewriter>${escapeHtml(block)}</p>
      `;
    })
    .join("");

  const bodyBlocks = (slide.bodyBlocks || [])
    .map((block) => {
      return `
        <p class="final-sequence__body" data-typewriter>${escapeHtml(block)}</p>
      `;
    })
    .join("");

  const showDivider = headlineBlocks || bodyBlocks;
  const showRestartButton = Boolean(slide.buttonText);

  const dotsHtml = slides
    .map((_, index) => {
      const activeClass = index === safeIndex ? " is-active" : "";
      return `<span class="final-sequence__dot${activeClass}" aria-hidden="true"></span>`;
    })
    .join("");

  return `
    <section class="end-card end-card--sequence" aria-labelledby="finalSequenceTitle">
      <div class="final-sequence">
        <div class="final-sequence__content">
          ${headlineBlocks}

          ${showDivider ? '<div class="end-card__divider" aria-hidden="true"></div>' : ""}

          ${bodyBlocks}

          ${
            showRestartButton
              ? `
                <button class="end-card__button final-sequence__button" type="button" data-action="restart">
                  <span class="end-card__button-label">${escapeHtml(slide.buttonText)}</span>
                  <span class="play-circle" aria-hidden="true"></span>
                </button>
              `
              : ""
          }
        </div>

        <div class="final-sequence__controls">
          <button
            class="final-sequence__arrow final-sequence__arrow--left ${safeIndex === 0 ? "is-disabled" : ""}"
            type="button"
            data-action="final-prev"
            aria-label="Pantalla anterior"
            ${safeIndex === 0 ? "disabled" : ""}
          >
            ‹
          </button>

          <div class="final-sequence__dots" aria-label="Progreso final">
            ${dotsHtml}
          </div>

          <button
            class="final-sequence__arrow final-sequence__arrow--right ${safeIndex === totalSlides - 1 ? "is-disabled" : ""}"
            type="button"
            data-action="final-next"
            aria-label="Siguiente pantalla"
            ${safeIndex === totalSlides - 1 ? "disabled" : ""}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  `;
}

function handleGameClick(event) {
  if (isTransitioning) {
    return;
  }

  const optionButton = event.target.closest("[data-option-index]");

  if (optionButton && app.contains(optionButton)) {
    const optionIndex = Number(optionButton.dataset.optionIndex);
    chooseOption(optionIndex);
    return;
  }

  const actionButton = event.target.closest("[data-action]");

  if (!actionButton || !app.contains(actionButton)) {
    return;
  }

  const action = actionButton.dataset.action;

  if (action === "start") {
    startGame();
    return;
  }

  if (action === "next") {
    goToNextScene();
    return;
  }

  if (action === "confirm-choice") {
    return;
  }

  if (action === "restart") {
    restartGame();
    return;
  }

  if (action === "instructions") {
    showInstructions();
    return;
  }

  if (action === "pause") {
    showPauseModal();
    return;
  }

  if (action === "exit") {
    showExitModal();
    return;
  }

  if (action === "toggle-music") {
    toggleMusic();
    return;
  }

  if (action === "final-prev") {
    changeFinalSlide(-1);
    return;
  }

  if (action === "final-next") {
    changeFinalSlide(1);
  }
}

function startGame() {
  const startScene = scenes.get(gameData.startScene);

  if (!startScene || !startScene.next) {
    console.error("La escena inicial no tiene next.");
    return;
  }

  playBackgroundMusic();
  goToScene(startScene.next);
}

function goToNextScene() {
  const scene = getCurrentScene();

  if (!scene || !scene.next) {
    console.error("Esta escena no tiene next:", currentSceneId);
    return;
  }

  goToScene(scene.next);
}

function chooseOption(optionIndex) {
  selectedOptionIndex = optionIndex;
  confirmChoice();
}

function confirmChoice() {
  const scene = getCurrentScene();

  if (!scene || scene.type !== "choice") {
    return;
  }

  if (selectedOptionIndex === null) {
    return;
  }

  const nextSceneId =
    selectedOptionIndex === scene.correctOption
      ? scene.successNext
      : scene.failNext;

  goToScene(nextSceneId);
}

function changeFinalSlide(step) {
  const scene = getCurrentScene();

  if (!scene || scene.type !== "final" || !Array.isArray(scene.slides)) {
    return;
  }

  const nextIndex = currentFinalSlideIndex + step;
  const maxIndex = scene.slides.length - 1;

  if (nextIndex < 0 || nextIndex > maxIndex) {
    return;
  }

  if (!canAnimateMotion()) {
    currentFinalSlideIndex = nextIndex;
    renderScene({
      animateIn: false,
      animateText: true
    });
    return;
  }

  const currentContent = app.querySelector(".final-sequence__content");
  const currentControls = app.querySelector(".final-sequence__controls");

  if (!currentContent) {
    currentFinalSlideIndex = nextIndex;
    renderScene();
    return;
  }

  if (activeTextTimeline) {
    activeTextTimeline.kill();
    activeTextTimeline = null;
  }

  isTransitioning = true;

  const exitDirection = step > 0 ? -80 : 80;
  const enterDirection = step > 0 ? 80 : -80;

  gsap.timeline({
    onComplete: () => {
      currentFinalSlideIndex = nextIndex;

      renderScene({
        animateIn: false,
        animateText: false
      });

      const nextContent = app.querySelector(".final-sequence__content");
      const nextControls = app.querySelector(".final-sequence__controls");
      const nextTextElements = app.querySelectorAll(".final-sequence [data-typewriter]");

      gsap.set(nextTextElements, {
        autoAlpha: 0
      });

      if (nextContent) {
        gsap.fromTo(
          nextContent,
          {
            autoAlpha: 0,
            x: enterDirection
          },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.72,
            ease: "power3.out",
            onComplete: () => {
              animateSceneText();
              isTransitioning = false;
            }
          }
        );
      } else {
        isTransitioning = false;
      }

      if (nextControls) {
        gsap.fromTo(
          nextControls,
          {
            autoAlpha: 0.55,
            y: 6
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.36,
            ease: "power2.out"
          }
        );
      }
    }
  })
    .to(
      currentContent,
      {
        autoAlpha: 0,
        x: exitDirection,
        duration: 0.48,
        ease: "power2.in"
      },
      0
    )
    .to(
      currentControls,
      {
        autoAlpha: 0.65,
        duration: 0.24,
        ease: "power2.in"
      },
      0
    );
}

function goToScene(sceneId) {
  transitionToScene(sceneId);
}

function restartGame() {
  stopBackgroundMusic();
  goToScene(gameData.startScene);
}

function showInstructions() {
  showModal({
    title: "INSTRUCCIONES",
    body:
      "Lee cada situación y elige cómo actuar.\n\nAlgunas pantallas solo te permitirán avanzar.\nOtras te pedirán tomar una decisión.\n\nHaz clic en los botones o en las opciones para continuar.",
    actions: [
      {
        label: "ENTENDIDO",
        action: "close",
        primary: true
      }
    ]
  });
}

function showPauseModal() {
  showModal({
    title: "JUEGO EN PAUSA",
    body: "Puedes continuar desde donde estabas o volver al inicio.",
    actions: [
      {
        label: "CONTINUAR",
        action: "close",
        primary: true
      },
      {
        label: "VOLVER A EMPEZAR",
        action: "restart",
        primary: false
      }
    ]
  });
}

function showExitModal() {
  showModal({
    title: "SALIR AL INICIO",
    body: "¿Quieres volver a la pantalla inicial?",
    actions: [
      {
        label: "CANCELAR",
        action: "close",
        primary: true
      },
      {
        label: "VOLVER AL INICIO",
        action: "restart",
        primary: false
      }
    ]
  });
}

function showModal({ title, body, actions }) {
  modalOpen = true;

  const buttonsHtml = actions
    .map((item) => {
      const primaryClass = item.primary ? "modal__button--primary" : "";

      return `
        <button
          class="modal__button ${primaryClass}"
          type="button"
          data-modal-action="${escapeAttribute(item.action)}"
        >
          ${escapeHtml(item.label)}
        </button>
      `;
    })
    .join("");

  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop="true">
      <section
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalTitle"
        aria-describedby="modalBody"
      >
        <button
          class="modal__close"
          type="button"
          data-modal-action="close"
          aria-label="Cerrar"
        >
          ×
        </button>

        <h2 id="modalTitle" class="modal__title">${escapeHtml(title)}</h2>

        <p id="modalBody" class="modal__body">${escapeHtml(body)}</p>

        <div class="modal__actions">
          ${buttonsHtml}
        </div>
      </section>
    </div>
  `;
}

function handleModalClick(event) {
  const clickedBackdrop = event.target.matches("[data-modal-backdrop='true']");
  const modalButton = event.target.closest("[data-modal-action]");

  if (clickedBackdrop) {
    closeModal();
    return;
  }

  if (!modalButton || !modalRoot.contains(modalButton)) {
    return;
  }

  const action = modalButton.dataset.modalAction;

  if (action === "close") {
    closeModal();
    return;
  }

  if (action === "restart") {
    restartGame();
  }
}

function closeModal() {
  if (!modalOpen && modalRoot.innerHTML === "") {
    return;
  }

  modalOpen = false;
  modalRoot.innerHTML = "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}

initGame();