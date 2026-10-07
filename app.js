const params = new URLSearchParams(window.location.search);
const TEST_MODE = params.get('all') === '1';

const state = {
  cards: [],
  artworks: {},
  currentIndex: 0,
  installEvent: null,
};

const refs = {
  artwork: document.getElementById('artwork'),
  artImage: document.getElementById('art-image'),
  artCaption: document.getElementById('art-caption'),
  reference: document.getElementById('verse-reference'),
  text: document.getElementById('verse-text'),
  dailyDate: document.getElementById('daily-date'),
  testNav: document.getElementById('test-nav'),
  prevBtn: document.getElementById('prev-btn'),
  randomBtn: document.getElementById('random-btn'),
  nextBtn: document.getElementById('next-btn'),
  installPrompt: document.getElementById('install-prompt'),
  installBtn: document.getElementById('install-btn'),
  installClose: document.getElementById('install-close'),
};

async function loadCards() {
  const response = await fetch('verses.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Не удалось загрузить verses.json');
  const data = await response.json();
  state.cards = Array.isArray(data.cards) ? data.cards : [];
  state.artworks = data.artworks || {};
}

function renderArtwork(card) {
  const art = state.artworks[card.art];
  if (!art) {
    refs.artwork.hidden = true;
    return;
  }
  refs.artImage.onerror = () => {
    refs.artwork.hidden = true;
  };
  refs.artImage.src = art.file;
  refs.artImage.alt = art.title ? `Картина: ${art.title}` : '';
  refs.artCaption.textContent = [art.title, art.author]
    .filter(Boolean)
    .join(' — ');
  refs.artwork.hidden = false;
}

function renderCard(card) {
  renderArtwork(card);
  refs.reference.textContent = card.reference;
  refs.text.textContent = card.text;
}

function dayNumber(date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  );
}

function formatDate(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function renderDaily() {
  const total = state.cards.length;
  if (total === 0) {
    refs.reference.textContent = '';
    refs.text.textContent = 'Стихи не найдены';
    return;
  }

  const today = new Date();
  const index = ((dayNumber(today) % total) + total) % total;
  renderCard(state.cards[index]);
  refs.dailyDate.textContent = formatDate(today);
}

function renderTest() {
  const total = state.cards.length;
  if (total === 0) {
    refs.reference.textContent = '';
    refs.text.textContent = 'Стихи не найдены';
    return;
  }
  renderCard(state.cards[state.currentIndex]);
  refs.dailyDate.textContent = `Стих ${state.currentIndex + 1} из ${total}`;
}

function navigate(direction) {
  const total = state.cards.length;
  if (total === 0) return;
  state.currentIndex = (state.currentIndex + direction + total) % total;
  renderTest();
}

function showRandom() {
  const total = state.cards.length;
  if (total === 0) return;
  let next = state.currentIndex;
  if (total > 1) {
    while (next === state.currentIndex) {
      next = Math.floor(Math.random() * total);
    }
  }
  state.currentIndex = next;
  renderTest();
}

function handleKeyboard(event) {
  if (event.key === 'ArrowLeft') {
    navigate(-1);
  } else if (event.key === 'ArrowRight') {
    navigate(1);
  } else if (event.key === ' ') {
    event.preventDefault();
    showRandom();
  }
}

function scheduleDailyRefresh() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    5
  );
  const delay = nextMidnight.getTime() - now.getTime();
  setTimeout(() => {
    renderDaily();
    scheduleDailyRefresh();
  }, delay);
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installEvent = event;
    refs.installPrompt.hidden = false;
  });

  refs.installBtn.addEventListener('click', async () => {
    if (!state.installEvent) return;
    refs.installPrompt.hidden = true;
    state.installEvent.prompt();
    await state.installEvent.userChoice;
    state.installEvent = null;
  });

  refs.installClose.addEventListener('click', () => {
    refs.installPrompt.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    refs.installPrompt.hidden = true;
    state.installEvent = null;
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((error) => {
        console.error('Ошибка регистрации service worker:', error);
      });
    });
  }
}

function setupTestMode() {
  const total = state.cards.length;
  refs.testNav.hidden = false;

  const start = Number.parseInt(params.get('i'), 10);
  state.currentIndex = Number.isInteger(start)
    ? ((start % total) + total) % total
    : 0;

  renderTest();

  refs.prevBtn.addEventListener('click', () => navigate(-1));
  refs.nextBtn.addEventListener('click', () => navigate(1));
  refs.randomBtn.addEventListener('click', showRandom);
  document.addEventListener('keydown', handleKeyboard);
}

function setupDailyMode() {
  renderDaily();
  scheduleDailyRefresh();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderDaily();
  });
}

async function init() {
  try {
    await loadCards();
  } catch (error) {
    console.error(error);
  }

  if (TEST_MODE && state.cards.length > 0) {
    setupTestMode();
  } else {
    setupDailyMode();
  }

  setupInstallPrompt();
  registerServiceWorker();
}

init();
