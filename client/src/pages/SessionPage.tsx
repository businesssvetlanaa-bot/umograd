import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { sessionsApi, type Message, type SessionData } from '../api/sessions'
import timMascot from '../assets/tim-mascot.png'

interface BrowserSpeechRecognitionEvent extends Event {
  results: ArrayLike<{ 0: { transcript: string } }>
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  error: string
}

interface BrowserSpeechRecognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

function extractEnglishWords(text: string): string {
  return (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? []).join('. ')
}

function prepareSpeechText(text: string): string {
  return text
    // Эмодзи остаются видимыми в чате, но синтезатор не произносит их названия.
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, ' ')
    .replace(/\u200D|\uFE0E|\uFE0F|\u20E3/gu, '')
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const SUBJECT_ICONS: Record<string, string> = {
  math:    '🔢',
  russian: '📖',
  english: '🌍',
}

const SUBJECT_NAMES: Record<string, string> = {
  math:    'Математика',
  russian: 'Русский язык',
  english: 'Английский язык',
}

function ThinkingDots() {
  return (
    <div className="flex items-end gap-1 px-4 py-3 rounded-2xl rounded-tl-sm" style={{ background: '#F0F4FF', width: 'fit-content' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{
            background: 'var(--color-primary)',
            animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

interface RewardScreenProps {
  childName: string
  xp: number
  coins: number
  childId: string
}

function RewardScreen({ childName, xp, coins, childId }: RewardScreenProps) {
  const navigate = useNavigate()
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Запускаем конфетти
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#818CF8'],
    })
    setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } }), 300)
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } }), 500)

    // Анимируем прогресс-бар
    if (barRef.current) {
      setTimeout(() => {
        if (barRef.current) barRef.current.style.width = '75%'
      }, 400)
    }
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-8"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Аватар с поднятыми руками */}
      <div
        className="w-32 h-32 rounded-2xl flex items-center justify-center text-7xl shadow-lg"
        style={{ background: 'var(--color-primary)' }}
      >
        🙌
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Ты молодец, {childName}!
        </h1>
        <p className="text-gray-500">Задание выполнено!</p>
      </div>

      {/* Награды */}
      <div className="flex gap-6">
        <div className="flex flex-col items-center bg-white rounded-2xl px-6 py-4 shadow-sm">
          <span className="text-4xl mb-1">⭐</span>
          <span className="text-2xl font-bold text-gray-800">+{xp}</span>
          <span className="text-sm text-gray-500">XP</span>
        </div>
        <div className="flex flex-col items-center bg-white rounded-2xl px-6 py-4 shadow-sm">
          <span className="text-4xl mb-1">💰</span>
          <span className="text-2xl font-bold text-gray-800">+{coins}</span>
          <span className="text-sm text-gray-500">монет</span>
        </div>
      </div>

      {/* Прогресс XP */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>Прогресс уровня</span>
          <span>+{xp} XP</span>
        </div>
        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            ref={barRef}
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: '0%', background: 'var(--color-primary)' }}
          />
        </div>
      </div>

      <button
        onClick={() => navigate(`/child/${childId}/world`)}
        className="w-full max-w-xs py-4 rounded-2xl font-bold text-white text-lg shadow-md active:scale-95 transition-transform"
        style={{ background: 'var(--color-primary)' }}
      >
        🏠 В мой мир
      </button>
    </div>
  )
}

export default function SessionPage() {
  const { id, session_id } = useParams<{ id: string; session_id: string }>()
  const navigate = useNavigate()

  const location = useLocation()
  const [session, setSession]       = useState<SessionData | null>(null)
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState('')
  const [thinking, setThinking]     = useState(false)
  const [sending, setSending]       = useState(false)
  const [listening, setListening]   = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [loadError, setLoadError]   = useState('')
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoPreview] = useState<string | null>(
    (location.state as { photoPreview?: string } | null)?.photoPreview ?? null
  )

  const [complete, setComplete]     = useState(false)
  const [xpEarned, setXpEarned]    = useState(0)
  const [coinsEarned, setCoinsEarned] = useState(0)
  const [childName, setChildName]   = useState('молодец')

  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const textareaRef     = useRef<HTMLTextAreaElement>(null)
  const photoInputRef   = useRef<HTMLInputElement>(null)
  const recognitionRef  = useRef<BrowserSpeechRecognition | null>(null)
  const listeningStartedAtRef = useRef(0)

  const [pendingPhoto, setPendingPhoto]               = useState<File | null>(null)
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState('')

  // Загружаем сессию при монтировании
  useEffect(() => {
    if (!session_id) return
    sessionsApi.get(session_id)
      .then(s => {
        setSession(s)
        setMessages(s.messages)
        setChildName(s.child.name)
        if (s.completed) {
          setComplete(true)
          setXpEarned(s.xp_earned)
          setCoinsEarned(s.coins_earned)
        }
      })
      .catch(e => setLoadError(e.message))
  }, [session_id])

  // Автопрокрутка
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => () => {
    recognitionRef.current?.stop()
    window.speechSynthesis?.cancel()
  }, [])

  function trackVoiceUsage(
    kind: 'speech_input' | 'speech_output' | 'speech_output_english',
    durationMs: number,
    characters = 0,
  ) {
    if (!session_id) return
    sessionsApi.trackVoiceUsage(session_id, {
      kind,
      duration_ms: durationMs,
      characters,
    }).catch(() => undefined)
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setVoiceError('В этом браузере голосовой ввод не поддерживается. Открой занятие в Chrome.')
      return
    }

    setVoiceError('')
    const recognition = new SpeechRecognition()
    recognition.lang = session?.subject === 'english' ? 'en-US' : 'ru-RU'
    recognition.interimResults = false
    recognition.continuous = false
    listeningStartedAtRef.current = Date.now()
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) {
        setInput(current => current ? `${current} ${transcript}` : transcript)
      }
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        setVoiceError(event.error === 'not-allowed'
          ? 'Разреши доступ к микрофону в настройках браузера.'
          : 'Не удалось разобрать речь. Нажми на микрофон и попробуй ещё раз.')
      }
    }
    recognition.onend = () => {
      setListening(false)
      const duration = Date.now() - listeningStartedAtRef.current
      if (duration > 0) trackVoiceUsage('speech_input', duration)
    }
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  function speakMessage(message: Message, englishOnly = false) {
    if (!('speechSynthesis' in window)) {
      setVoiceError('Озвучивание не поддерживается этим браузером.')
      return
    }

    window.speechSynthesis.cancel()
    if (speakingMessageId === message.id) {
      setSpeakingMessageId(null)
      return
    }

    const speechText = englishOnly
      ? extractEnglishWords(message.content)
      : prepareSpeechText(message.content)
    if (!speechText) {
      setVoiceError('В этом сообщении нет английских слов для произношения.')
      return
    }

    setVoiceError('')
    const utterance = new SpeechSynthesisUtterance(speechText)
    utterance.lang = englishOnly ? 'en-US' : 'ru-RU'
    utterance.rate = englishOnly ? 0.65 : 0.9
    const startedAt = Date.now()
    utterance.onend = () => {
      setSpeakingMessageId(null)
      trackVoiceUsage(englishOnly ? 'speech_output_english' : 'speech_output', Date.now() - startedAt, speechText.length)
    }
    utterance.onerror = () => {
      setSpeakingMessageId(null)
      setVoiceError('Не получилось озвучить сообщение. Попробуй ещё раз.')
    }
    setSpeakingMessageId(message.id)
    window.speechSynthesis.speak(utterance)
  }

  // Авторесайз textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingPhoto(file)
    setPendingPhotoPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function clearPendingPhoto() {
    setPendingPhoto(null)
    setPendingPhotoPreview('')
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text && !pendingPhoto || sending || !session_id) return

    setSending(true)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const optimisticContent = pendingPhoto
      ? (text ? `📷 ${text}` : '📷 Отправляю фото ответа...')
      : text
    const capturedPhoto = pendingPhoto
    clearPendingPhoto()

    // Оптимистично добавляем сообщение пользователя
    const userMsgId = crypto.randomUUID()
    const userMsg: Message = {
      id:         userMsgId,
      session_id: session_id,
      role:       'user',
      content:    optimisticContent,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setThinking(true)

    try {
      let payload: Parameters<typeof sessionsApi.sendMessage>[1] = { content: text || undefined }

      if (capturedPhoto) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
          reader.onerror = reject
          reader.readAsDataURL(capturedPhoto)
        })
        payload = { content: text || undefined, image_base64: base64, image_mime_type: capturedPhoto.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }
      }

      const res = await sessionsApi.sendMessage(session_id, payload)

      // Обновляем оптимистичное сообщение реальным содержимым (с распознанным текстом)
      setMessages(prev => prev.map(m =>
        m.id === userMsgId ? { ...m, content: res.user_content } : m
      ))

      const assistantMsg: Message = {
        id:         crypto.randomUUID(),
        session_id: session_id,
        role:       'assistant',
        content:    res.message,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])

      if (res.session_complete) {
        setXpEarned(res.xp_earned ?? 0)
        setCoinsEarned(res.coins_earned ?? 0)
        setTimeout(() => setComplete(true), 1800)
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== userMsgId))
    } finally {
      setThinking(false)
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !pendingPhoto) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ─── Экран награды ───
  if (complete) {
    return (
      <RewardScreen
        childName={childName}
        xp={xpEarned}
        coins={coinsEarned}
        childId={id ?? ''}
      />
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: 'var(--color-bg)' }}>
        <p className="text-red-500 text-center">{loadError}</p>
        <button
          onClick={() => navigate(`/child/${id}/tutor`)}
          className="px-6 py-3 rounded-xl font-bold text-white"
          style={{ background: 'var(--color-primary)' }}
        >
          ← Назад
        </button>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-gray-400">Загрузка...</div>
      </div>
    )
  }

  const subjectIcon = SUBJECT_ICONS[session.subject] ?? '📚'
  const subjectName = SUBJECT_NAMES[session.subject] ?? session.subject
  const topicTitle  = session.topic?.title ?? subjectName

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(circle at 10% 0%, #dbeafe 0, transparent 24%), radial-gradient(circle at 90% 10%, #ccfbf1 0, transparent 22%), #f5f7ff' }}>

      {/* ─── Верхняя панель ─── */}
      <div className="sticky top-0 z-10 border-b border-white/80 bg-white/90 px-4 py-3 flex items-center gap-3 shadow-sm backdrop-blur-xl">
        <Link to={`/child/${id}/tutor`} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
          ←
        </Link>
        <span className="text-2xl">{subjectIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-800 truncate">{topicTitle}</div>
          <div className="text-xs text-gray-400">{subjectName}</div>
        </div>
        {photoPreview && (
          <button
            onClick={() => setShowPhotoModal(true)}
            className="flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            👁️ ДЗ
          </button>
        )}
      </div>

      {/* ─── Чат ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4 w-full max-w-4xl mx-auto">

        {/* Аватар и имя репетитора */}
        <div className="flex items-center gap-3 mb-2 rounded-2xl border border-white bg-white/80 p-3 shadow-sm backdrop-blur">
          <div
            className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 bg-indigo-950"
            style={{ background: 'var(--color-primary)' }}
          >
            <img src={timMascot} alt="Тим" className="h-full w-full object-cover object-top" />
          </div>
          <div>
            <div className="font-bold text-gray-800">Тим</div>
            <div className="text-xs text-gray-400">Твой репетитор</div>
          </div>
        </div>

        {/* Сообщения */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 mr-2 self-end bg-indigo-950 shadow-sm"
                style={{ background: 'var(--color-primary)' }}
              >
                <img src={timMascot} alt="" className="h-full w-full object-cover object-top" />
              </div>
            )}
            <div className="max-w-[85%]">
              <div
                className="px-4 py-3 rounded-2xl text-base leading-relaxed whitespace-pre-wrap"
                style={
                  msg.role === 'user'
                    ? { background: 'var(--color-primary)', color: 'white', borderBottomRightRadius: 4 }
                    : { background: 'rgba(255,255,255,.94)', color: '#1e293b', borderBottomLeftRadius: 4, border: '1px solid #E0E7FF', boxShadow: '0 8px 24px rgba(49,46,129,.06)' }
                }
              >
                {msg.content}
              </div>
              {msg.role === 'assistant' && (
                <div className="flex flex-wrap gap-2 mt-1 ml-1">
                  <button
                    type="button"
                    onClick={() => speakMessage(msg)}
                    className="text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg px-2.5 py-1.5 active:scale-95"
                  >
                    {speakingMessageId === msg.id ? '⏹ Остановить' : '🔊 Прослушать'}
                  </button>
                  {session.subject === 'english' && extractEnglishWords(msg.content) && (
                    <button
                      type="button"
                      onClick={() => speakMessage(msg, true)}
                      className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 active:scale-95"
                    >
                      🇬🇧 Английские слова медленно
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Индикатор "думает" */}
        {thinking && (
          <div className="flex items-end gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: 'var(--color-primary)' }}
            >
              🎓
            </div>
            <ThinkingDots />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Поле ввода ─── */}
      <div className="sticky bottom-0 border-t border-white/80 bg-white/92 px-4 py-3 shadow-[0_-8px_30px_rgba(49,46,129,.06)] backdrop-blur-xl">
        {/* Скрытый input для камеры */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelect}
        />

        {/* Превью фото ответа */}
        {pendingPhotoPreview && (
          <div className="flex items-center gap-2 mb-2 max-w-2xl mx-auto">
            <div className="relative flex-shrink-0">
              <img
                src={pendingPhotoPreview}
                alt="Фото ответа"
                className="h-14 w-14 rounded-xl object-cover border-2 border-[var(--color-primary)]"
              />
              <button
                onClick={clearPendingPhoto}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center leading-none"
              >
                ✕
              </button>
            </div>
            <span className="text-sm text-gray-500">📷 Фото ответа прикреплено</span>
          </div>
        )}

        {voiceError && <p className="text-center text-sm text-red-500 mb-2">{voiceError}</p>}
        {listening && <p className="text-center text-sm font-semibold text-red-500 mb-2">🎙 Слушаю… говори спокойно</p>}

        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder={pendingPhoto ? 'Добавь комментарий (необязательно)...' : 'Напиши ответ...'}
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-2xl border-2 border-gray-200 focus:border-[var(--color-primary)] outline-none px-4 py-3 text-base text-gray-800 disabled:opacity-60"
            style={{ maxHeight: 120, overflowY: 'auto' }}
          />
          <button
            type="button"
            onClick={toggleListening}
            disabled={sending}
            title={listening ? 'Остановить запись' : 'Ответить голосом'}
            className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl transition-all active:scale-95 disabled:opacity-40"
            style={{ background: listening ? '#EF4444' : '#EEF2FF', color: listening ? 'white' : '#4338CA' }}
          >
            {listening ? '⏹' : '🎙'}
          </button>
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={sending}
            title="Сфотографировать ответ"
            className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: pendingPhoto ? 'var(--color-primary)' : '#F3F4F6',
              color: pendingPhoto ? 'white' : '#6B7280',
            }}
          >
            📷
          </button>
          <button
            onClick={sendMessage}
            disabled={sending || (!input.trim() && !pendingPhoto)}
            className="w-12 h-12 rounded-2xl font-bold text-white flex-shrink-0 flex items-center justify-center text-xl disabled:opacity-40 active:scale-95 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            {sending ? '⏳' : '↑'}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-1">Нажми 🎙, скажи ответ, проверь текст и отправь</p>
      </div>

      {/* ─── Модалка фото ─── */}
      {showPhotoModal && photoPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="bg-white rounded-2xl p-3 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img src={photoPreview} alt="Домашнее задание" className="w-full rounded-xl" />
            <button
              className="mt-3 w-full py-2 rounded-xl bg-gray-100 text-gray-600 font-semibold"
              onClick={() => setShowPhotoModal(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
