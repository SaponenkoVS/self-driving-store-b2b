"use client"

import { useState, useTransition } from "react"
import { QuoteMessage, sendQuoteMessage } from "@lib/data/quotes"
import { card, eyebrow, fieldClass, primaryButton } from "../company/format"

const AUTHOR: Record<string, string> = {
  customer: "You",
  merchant: "STRATA trade desk",
  system: "Update",
}

const QuoteMessages = ({ quoteId, messages }: { quoteId: string; messages: QuoteMessage[] }) => {
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const send = () =>
    startTransition(async () => {
      if (!text.trim()) {
        return
      }
      const result = await sendQuoteMessage(quoteId, text.trim())
      setError(result.error)
      if (result.success) {
        setText("")
      }
    })

  return (
    <section className={card} data-testid="quote-messages">
      <p className={eyebrow}>Messages</p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Conversation</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {messages.length ? (
          messages.map((message) => (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-large px-4 py-3 text-sm ${
                message.author_type === "customer"
                  ? "self-end bg-ink text-white"
                  : message.author_type === "merchant"
                    ? "self-start bg-concrete-100 text-ink"
                    : "self-center bg-white text-ink-600 ring-1 ring-concrete-200"
              }`}
            >
              <p className="text-xs font-semibold opacity-75">
                {AUTHOR[message.author_type]} - {new Date(message.created_at).toLocaleString("en-GB")}
              </p>
              <p className="mt-1 whitespace-pre-line">{message.text}</p>
            </li>
          ))
        ) : (
          <li className="text-sm text-ink-600">No messages yet. Ask about delivery, alternatives or quantities.</li>
        )}
      </ul>
      <div className="mt-4 flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder="Write a message to the trade desk"
          className={fieldClass}
          data-testid="quote-message-input"
        />
        <div className="flex items-center justify-between gap-2">
          {error ? <p className="text-sm text-rose-600">{error}</p> : <span />}
          <button type="button" className={primaryButton} onClick={send} disabled={pending || !text.trim()}>
            Send
          </button>
        </div>
      </div>
    </section>
  )
}

export default QuoteMessages
