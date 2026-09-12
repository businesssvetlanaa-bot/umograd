export type BuildingType =
  | 'house'
  | 'tree'
  | 'lantern'
  | 'well'
  | 'windmill'
  | 'tower'
  | 'castle'
  | 'library'
  | 'english_flag'
  | 'fountain'
  | 'market'
  | 'school'
  | 'farm'
  | 'barn'
  | 'bridge'
  | 'gazebo'
  | 'garden'
  | 'dragon'
  | 'ship'
  | 'lighthouse'
  | 'forge'
  | 'inn'
  | 'temple'
  | 'arena'
  | 'greenhouse'
  | 'observatory'
  | 'treasure'
  | 'flower_bed'
  | 'pond'
  | 'statue'
  | 'campfire'
  | 'tent'

export interface BuildingDefinition {
  type: BuildingType
  name: string
  emoji: string
  description: string
  cost: number
  required_level: number
  required_sessions: number
  required_subject?: 'math' | 'russian' | 'english'
  required_mastery?: number
  unlock_hint: string
  is_starter: boolean
}

export const BUILDINGS_CATALOG: BuildingDefinition[] = [
  // ── Уровень 1 (стартовые и самые простые) ──────────────────────────────────
  {
    type: 'house',
    name: 'Домик',
    emoji: '🏠',
    description: 'Уютный домик — твоя стартовая постройка в мире Умограда!',
    cost: 0,
    required_level: 1,
    required_sessions: 0,
    unlock_hint: 'Твоя первая постройка! Уже разблокирована.',
    is_starter: true,
  },
  {
    type: 'campfire',
    name: 'Костёр',
    emoji: '🔥',
    description: 'Уютный костёр, вокруг которого собираются друзья.',
    cost: 20,
    required_level: 1,
    required_sessions: 1,
    unlock_hint: 'Проведи 1 занятие с репетитором.',
    is_starter: false,
  },
  {
    type: 'tree',
    name: 'Волшебное дерево',
    emoji: '🌲',
    description: 'Высокое дерево украсит твой мир и принесёт удачу.',
    cost: 30,
    required_level: 1,
    required_sessions: 1,
    unlock_hint: 'Проведи 1 занятие с репетитором.',
    is_starter: false,
  },
  {
    type: 'flower_bed',
    name: 'Клумба',
    emoji: '🌺',
    description: 'Яркая клумба с цветами делает мир красивее!',
    cost: 35,
    required_level: 1,
    required_sessions: 2,
    unlock_hint: 'Проведи 2 занятия.',
    is_starter: false,
  },
  {
    type: 'tent',
    name: 'Шатёр',
    emoji: '⛺',
    description: 'Уютный шатёр путешественника — место для отдыха после учёбы.',
    cost: 45,
    required_level: 1,
    required_sessions: 2,
    unlock_hint: 'Проведи 2 занятия.',
    is_starter: false,
  },
  // ── Уровень 2 ───────────────────────────────────────────────────────────────
  {
    type: 'pond',
    name: 'Пруд',
    emoji: '🌊',
    description: 'Красивый пруд с утками — уголок природы в твоём мире.',
    cost: 60,
    required_level: 2,
    required_sessions: 3,
    unlock_hint: 'Достигни 2 уровня и проведи 3 занятия.',
    is_starter: false,
  },
  {
    type: 'lantern',
    name: 'Волшебный фонарь',
    emoji: '🪔',
    description: 'Освещает путь даже в самую тёмную ночь.',
    cost: 50,
    required_level: 2,
    required_sessions: 3,
    unlock_hint: 'Достигни 2 уровня и проведи 3 занятия.',
    is_starter: false,
  },
  {
    type: 'garden',
    name: 'Волшебный сад',
    emoji: '🌳',
    description: 'Сад с фруктовыми деревьями, где растут знания.',
    cost: 70,
    required_level: 2,
    required_sessions: 4,
    unlock_hint: 'Достигни 2 уровня и проведи 4 занятия.',
    is_starter: false,
  },
  {
    type: 'well',
    name: 'Колодец мудрости',
    emoji: '🪣',
    description: 'Из этого колодца черпают знания все жители твоего мира.',
    cost: 80,
    required_level: 2,
    required_sessions: 5,
    required_subject: 'math',
    required_mastery: 20,
    unlock_hint: 'Освой математику на 20% и проведи 5 занятий.',
    is_starter: false,
  },
  {
    type: 'barn',
    name: 'Амбар',
    emoji: '🛖',
    description: 'Просторный амбар для хранения знаний и припасов.',
    cost: 90,
    required_level: 2,
    required_sessions: 5,
    required_subject: 'russian',
    required_mastery: 15,
    unlock_hint: 'Освой русский язык на 15% и проведи 5 занятий.',
    is_starter: false,
  },
  // ── Уровень 3 ───────────────────────────────────────────────────────────────
  {
    type: 'farm',
    name: 'Ферма',
    emoji: '🌾',
    description: 'Ферма даёт урожай знаний каждый день!',
    cost: 100,
    required_level: 3,
    required_sessions: 7,
    required_subject: 'math',
    required_mastery: 25,
    unlock_hint: 'Достигни 3 уровня и освой математику на 25%.',
    is_starter: false,
  },
  {
    type: 'gazebo',
    name: 'Беседка',
    emoji: '⛩️',
    description: 'Красивая беседка в саду — место для размышлений.',
    cost: 110,
    required_level: 3,
    required_sessions: 7,
    unlock_hint: 'Достигни 3 уровня и проведи 7 занятий.',
    is_starter: false,
  },
  {
    type: 'windmill',
    name: 'Мельница',
    emoji: '🎡',
    description: 'Мельница превращает знания в энергию для новых открытий!',
    cost: 120,
    required_level: 3,
    required_sessions: 8,
    required_subject: 'russian',
    required_mastery: 20,
    unlock_hint: 'Достигни 3 уровня и освой русский язык на 20%.',
    is_starter: false,
  },
  {
    type: 'fountain',
    name: 'Фонтан',
    emoji: '⛲',
    description: 'Красивый фонтан украшает центральную площадь твоего мира.',
    cost: 130,
    required_level: 3,
    required_sessions: 8,
    required_subject: 'english',
    required_mastery: 20,
    unlock_hint: 'Освой английский язык на 20% и проведи 8 занятий.',
    is_starter: false,
  },
  {
    type: 'bridge',
    name: 'Мост',
    emoji: '🌉',
    description: 'Мост соединяет разные части твоего мира знаний.',
    cost: 150,
    required_level: 3,
    required_sessions: 9,
    unlock_hint: 'Достигни 3 уровня и проведи 9 занятий.',
    is_starter: false,
  },
  // ── Уровень 4 ───────────────────────────────────────────────────────────────
  {
    type: 'greenhouse',
    name: 'Теплица',
    emoji: '🌿',
    description: 'В теплице растут редкие знания круглый год.',
    cost: 160,
    required_level: 4,
    required_sessions: 10,
    required_subject: 'russian',
    required_mastery: 30,
    unlock_hint: 'Достигни 4 уровня и освой русский язык на 30%.',
    is_starter: false,
  },
  {
    type: 'inn',
    name: 'Таверна',
    emoji: '🏨',
    description: 'Таверна — место встречи путешественников и обмена историями.',
    cost: 170,
    required_level: 4,
    required_sessions: 10,
    unlock_hint: 'Достигни 4 уровня и проведи 10 занятий.',
    is_starter: false,
  },
  {
    type: 'market',
    name: 'Рынок',
    emoji: '🏪',
    description: 'Оживлённый рынок, где торгуют знаниями и редкими предметами.',
    cost: 180,
    required_level: 4,
    required_sessions: 11,
    required_subject: 'math',
    required_mastery: 35,
    unlock_hint: 'Достигни 4 уровня и освой математику на 35%.',
    is_starter: false,
  },
  {
    type: 'forge',
    name: 'Кузница',
    emoji: '⚒️',
    description: 'В кузнице куют оружие знаний! Очень полезное место.',
    cost: 190,
    required_level: 4,
    required_sessions: 11,
    required_subject: 'math',
    required_mastery: 35,
    unlock_hint: 'Освой математику на 35% и проведи 11 занятий.',
    is_starter: false,
  },
  {
    type: 'tower',
    name: 'Башня наблюдения',
    emoji: '🗼',
    description: 'С башни видно весь мир знаний! Открывает новые горизонты.',
    cost: 200,
    required_level: 4,
    required_sessions: 12,
    required_subject: 'math',
    required_mastery: 40,
    unlock_hint: 'Достигни 4 уровня и освой математику на 40%.',
    is_starter: false,
  },
  {
    type: 'english_flag',
    name: 'Английский флаг',
    emoji: '🏴',
    description: 'Флаг страны Знаний развевается над твоим миром!',
    cost: 250,
    required_level: 4,
    required_sessions: 10,
    required_subject: 'english',
    required_mastery: 40,
    unlock_hint: 'Освой английский язык на 40%.',
    is_starter: false,
  },
  // ── Уровень 5 ───────────────────────────────────────────────────────────────
  {
    type: 'statue',
    name: 'Статуя мудреца',
    emoji: '🗿',
    description: 'Статуя легендарного мудреца — символ великих знаний.',
    cost: 270,
    required_level: 5,
    required_sessions: 14,
    required_subject: 'russian',
    required_mastery: 40,
    unlock_hint: 'Достигни 5 уровня и освой русский язык на 40%.',
    is_starter: false,
  },
  {
    type: 'ship',
    name: 'Корабль',
    emoji: '⛵',
    description: 'Парусный корабль готов к плаванию по морям знаний!',
    cost: 280,
    required_level: 5,
    required_sessions: 14,
    required_subject: 'english',
    required_mastery: 45,
    unlock_hint: 'Достигни 5 уровня и освой английский язык на 45%.',
    is_starter: false,
  },
  {
    type: 'lighthouse',
    name: 'Маяк',
    emoji: '🏮',
    description: 'Маяк указывает путь к знаниям в любой шторм.',
    cost: 300,
    required_level: 5,
    required_sessions: 15,
    required_subject: 'english',
    required_mastery: 45,
    unlock_hint: 'Достигни 5 уровня и освой английский язык на 45%.',
    is_starter: false,
  },
  {
    type: 'temple',
    name: 'Храм',
    emoji: '🛕',
    description: 'Древний храм хранит секреты всех наук.',
    cost: 320,
    required_level: 5,
    required_sessions: 15,
    required_mastery: 30,
    unlock_hint: 'Достигни 5 уровня и освой каждый предмет на 30%.',
    is_starter: false,
  },
  {
    type: 'library',
    name: 'Библиотека',
    emoji: '📚',
    description: 'В этой библиотеке хранятся все твои выученные темы. Гордость любого мира!',
    cost: 350,
    required_level: 5,
    required_sessions: 15,
    required_mastery: 30,
    unlock_hint: 'Освой каждый предмет хотя бы на 30% и проведи 15 занятий.',
    is_starter: false,
  },
  // ── Уровень 6 ───────────────────────────────────────────────────────────────
  {
    type: 'arena',
    name: 'Арена',
    emoji: '🏟️',
    description: 'Арена для соревнований умов — здесь рождаются чемпионы!',
    cost: 370,
    required_level: 6,
    required_sessions: 18,
    required_subject: 'math',
    required_mastery: 50,
    unlock_hint: 'Достигни 6 уровня и освой математику на 50%.',
    is_starter: false,
  },
  {
    type: 'school',
    name: 'Школа',
    emoji: '🏫',
    description: 'Настоящая школа в твоём мире! Здесь учатся все жители.',
    cost: 380,
    required_level: 6,
    required_sessions: 18,
    required_mastery: 45,
    unlock_hint: 'Достигни 6 уровня и освой каждый предмет на 45%.',
    is_starter: false,
  },
  {
    type: 'castle',
    name: 'Замок знаний',
    emoji: '🏰',
    description: 'Великолепный замок — символ твоих выдающихся достижений!',
    cost: 400,
    required_level: 6,
    required_sessions: 20,
    required_subject: 'russian',
    required_mastery: 50,
    unlock_hint: 'Достигни 6 уровня, освой русский язык на 50% и проведи 20 занятий.',
    is_starter: false,
  },
  // ── Уровень 7+ (редкие и легендарные) ───────────────────────────────────────
  {
    type: 'observatory',
    name: 'Обсерватория',
    emoji: '🔭',
    description: 'Обсерватория открывает тайны Вселенной для самых умных!',
    cost: 450,
    required_level: 7,
    required_sessions: 22,
    required_subject: 'math',
    required_mastery: 60,
    unlock_hint: 'Достигни 7 уровня и освой математику на 60%.',
    is_starter: false,
  },
  {
    type: 'treasure',
    name: 'Сокровищница',
    emoji: '💎',
    description: 'Легендарная сокровищница хранит самые ценные знания!',
    cost: 500,
    required_level: 7,
    required_sessions: 25,
    required_mastery: 55,
    unlock_hint: 'Достигни 7 уровня и освой каждый предмет на 55%.',
    is_starter: false,
  },
  {
    type: 'dragon',
    name: 'Дракон',
    emoji: '🐉',
    description: 'Мудрый дракон охраняет твой мир. Только самые умные могут его приручить!',
    cost: 600,
    required_level: 8,
    required_sessions: 30,
    required_mastery: 65,
    unlock_hint: 'Достигни 8 уровня и освой каждый предмет на 65%.',
    is_starter: false,
  },
]

/** Получить постройку по типу */
export function getBuildingByType(type: BuildingType): BuildingDefinition | undefined {
  return BUILDINGS_CATALOG.find((b) => b.type === type)
}

/** Стартовые постройки — выдаются при создании аккаунта */
export const STARTER_BUILDINGS = BUILDINGS_CATALOG.filter((b) => b.is_starter)
