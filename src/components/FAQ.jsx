import { useState } from 'react'

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  const faqs = [
    {
      question: "Is Chirp free?",
      answer: "Chirp is free to try. Advanced features may require a plan."
    },
    {
      question: "What permissions are required?",
      answer: "Moderation and management permissions; the invite dialog shows the exact list."
    },
    {
      question: "How do I manage settings?",
      answer: "Use the dashboard after inviting Chirp to your server."
    }
  ]

  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <section id="faq" className="faq">
      <div className="container">
        <div className="glass faq__card">
          <h2>FAQ</h2>
          {faqs.map((faq, index) => (
            <details key={index} open={openIndex === index}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

