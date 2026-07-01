'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const SEED_MESSAGE = {
  role: 'assistant',
  content: "Hello. I'm Nest. I manage the information flow for Boro & Nest Collective — the only NYC firm closing the loop between QEWI inspection, repair GC, DOB closeout, and PACE financing under one contract with a board-facing transparency portal. How can we help you streamline your build-out or compliance today?"
};

function extractCTA(text) {
  const match = text.match(/\[\[CTA:(SCOPING_CALL|DISCOVERY_FORM|SUB_APPLICATION)\]\]/);
  if (!match) return { clean: text, cta: null };
  return { clean: text.replace(match[0], '').trim(), cta: match[1] };
}

const CTA_CONFIG = {
  SCOPING_CALL: { label: 'Book a Scoping Call', href: '/book-call' },
  DISCOVERY_FORM: { label: 'Start Discovery Form', href: '/join/client' },
  SUB_APPLICATION: { label: 'Apply as Subcontractor', href: '/join/subcontractor' }
};

export default function NestChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([SEED_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Try to load current user for personalization
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d.user)).catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          userContext: user ? { name: user.name, role: user.role, onboardingComplete: user.onboardingComplete } : null
        })
      });
      if (!res.ok || !res.body) throw new Error('chat failed');

      // Add empty assistant message and stream chunks in
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: acc };
          return copy;
        });
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry — Nest is momentarily offline. Please try again in a moment.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="group flex items-center gap-3 rounded-full bg-primary px-5 py-3.5 text-primary-foreground shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all"
          >
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/15 text-sm font-bold">N</div>
            <div className="text-left">
              <div className="text-sm font-semibold leading-tight">Ask Nest</div>
              <div className="text-[10px] opacity-70 leading-tight">AI project concierge</div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-gradient-to-r from-card to-card/50">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground font-bold">N</div>
                <div>
                  <div className="text-sm font-semibold flex items-center gap-1.5">Nest <Sparkles className="h-3 w-3 text-primary" /></div>
                  <div className="text-[11px] text-muted-foreground">Boro & Nest AI concierge</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => {
                const { clean, cta } = m.role === 'assistant' ? extractCTA(m.content) : { clean: m.content, cta: null };
                return (
                  <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div className="flex max-w-[85%] gap-2">
                      {m.role === 'assistant' && (
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">N</div>
                      )}
                      <div>
                        <div className={
                          m.role === 'user'
                            ? 'rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm'
                            : 'rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground whitespace-pre-wrap'
                        }>
                          {clean || (loading && i === messages.length - 1 ? <span className="inline-flex items-center gap-1 text-muted-foreground"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Thinking…</span> : '')}
                        </div>
                        {cta && CTA_CONFIG[cta] && (
                          <Link href={CTA_CONFIG[cta].href} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                            {CTA_CONFIG[cta].label} →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <form onSubmit={send} className="border-t border-border p-3 bg-card">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask about GMP, permits, LL11/LL97, timelines…"
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button type="submit" disabled={loading || !input.trim()} size="icon" className="h-9 w-9 shrink-0">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-1.5 text-center text-[10px] text-muted-foreground">Nest is AI — may make mistakes. Verify critical facts.</div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
