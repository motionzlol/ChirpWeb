import { useState, useRef, useEffect } from 'react'

export default function FAQ() {
  const [openStates, setOpenStates] = useState({});
  const contentRefs = useRef({});

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

  const toggleFAQ = (index) => {
    setOpenStates(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <section id="faq" className="faq">
      <div className="container">
        <div className="glass faq__card">
          <h2>FAQ</h2>
          {faqs.map((faq, index) => (
            <details
              key={index}
              open={openStates[index]}
              onToggle={(e) => {
                if (!prefersReduced) {
                  e.preventDefault(); // Prevent default toggle behavior for animation
                }
                toggleFAQ(index);
              }}
            >
              <summary>{faq.question}</summary>
              <div
                ref={el => contentRefs.current[index] = el}
                style={{
                  maxHeight: openStates[index] ? (contentRefs.current[index]?.scrollHeight || 'auto') : 0,
                  overflow: 'hidden',
                  transition: prefersReduced ? 'none' : 'max-height 0.3s ease-out'
                }}
              >
                <p>{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

