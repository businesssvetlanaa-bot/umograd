import { useEffect, useRef, useState } from 'react'

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

function messageForError(error: string): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Разреши доступ к микрофону в браузере и попробуй ещё раз.'
  }
  if (error === 'no-speech') return 'Я не услышал речь. Попробуй сказать фразу ещё раз.'
  return 'Не получилось разобрать речь. Можно сказать ещё раз или написать текст.'
}

interface VoiceDictationButtonProps {
  language: 'ru-RU' | 'en-US'
  disabled?: boolean
  onTranscript: (text: string) => void
}

/**
 * Browser-only dictation. The audio never leaves the browser; only the
 * recognised text is passed to the parent, where a child may edit it first.
 */
export function VoiceDictationButton({ language, disabled = false, onTranscript }: VoiceDictationButtonProps) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => recognitionRef.current?.stop(), [])

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError('Голосовой ввод пока не поддерживается этим браузером. Открой Умоград в Chrome или напиши текст.')
      return
    }

    setError('')
    const recognition = new SpeechRecognition()
    recognition.lang = language
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) onTranscript(transcript)
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setError(messageForError(event.error))
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    try {
      recognition.start()
    } catch {
      setListening(false)
      setError('Не получилось включить микрофон. Попробуй ещё раз или напиши текст.')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? 'Остановить голосовой ввод' : 'Сказать вопрос голосом'}
        className="min-h-12 rounded-2xl border-2 px-4 text-sm font-black transition active:scale-[.98] disabled:opacity-50"
        style={{
          borderColor: listening ? '#ef4444' : '#c7d2fe',
          background: listening ? '#ef4444' : '#eef2ff',
          color: listening ? 'white' : '#3730a3',
        }}
      >
        {listening ? '⏹ Остановить' : '🎙 Сказать голосом'}
      </button>
      {listening && <p className="text-center text-xs font-bold text-red-500">Слушаю… говори спокойно</p>}
      {error && <p role="alert" className="text-center text-xs font-semibold text-red-600">{error}</p>}
    </div>
  )
}
