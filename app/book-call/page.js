'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';
import { toast } from 'sonner';
import { CheckCircle2, Calendar, Clock, Shield, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BookCallPage() {
  const [data, setData] = useState({ preferredDate: '', preferredTime: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function upd(k, v) { setData(d => ({ ...d, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/scoping-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) { setSubmitted(true); toast.success('Request received. We\'ll be in touch within 24 hours.'); }
    else { toast.error('Something went wrong'); }
    setLoading(false);
  }

  if (submitted) {
    return (
      <>
        <SiteNav />
        <div className="container flex min-h-[70vh] items-center justify-center py-16">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15"><CheckCircle2 className="h-8 w-8 text-primary" /></div>
            <h1 className="mt-6 text-3xl font-bold">Request received.</h1>
            <p className="mt-3 text-muted-foreground">One of our PMs will reach out within 24 hours to confirm your scoping call. We'll return a Guaranteed Maximum Price within 5 business days of the call.</p>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <div className="container grid gap-12 py-12 md:grid-cols-2 md:py-20">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Book a Scoping Call</div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">20 minutes to a<br /><span className="text-gradient-royal">GMP ceiling.</span></h1>
          <p className="mt-4 text-muted-foreground">Tell us about your space and timeline. On the call, we walk through scope, budget, and permitting. Within 5 business days we return a Guaranteed Maximum Price you can present to your board or investors.</p>

          <div className="mt-8 space-y-4">
            <Feature icon={Calendar} title="20-min call, no pitch" text="We spend the time on your project, not our credentials." />
            <Feature icon={Clock} title="GMP within 5 business days" text="After a walk-through or plan review, you get a fixed ceiling." />
            <Feature icon={Shield} title="No sales tax on the call" text="If we can't do it, we tell you upfront and refer you." />
          </div>
        </div>

        <div>
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" required><Input required value={data.fullName || ''} onChange={e => upd('fullName', e.target.value)} /></Field>
              <Field label="Company"><Input value={data.company || ''} onChange={e => upd('company', e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Email" required><Input type="email" required value={data.email || ''} onChange={e => upd('email', e.target.value)} /></Field>
              <Field label="Phone" required><Input type="tel" required value={data.phone || ''} onChange={e => upd('phone', e.target.value)} /></Field>
            </div>
            <Field label="Project address">
              <Input placeholder="287 Bedford Ave, Brooklyn, NY" value={data.address || ''} onChange={e => upd('address', e.target.value)} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Project type" required>
                <Select value={data.projectType || ''} onValueChange={v => upd('projectType', v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{['Commercial build-out', 'Residential gut renovation', 'LL11/LL97 compliance', 'Other'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Estimated budget">
                <Select value={data.budget || ''} onValueChange={v => upd('budget', v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{['< $150K', '$150K – $250K', '$250K – $500K', '$500K+'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Preferred date"><Input type="date" value={data.preferredDate} onChange={e => upd('preferredDate', e.target.value)} /></Field>
              <Field label="Preferred time">
                <Select value={data.preferredTime} onValueChange={v => upd('preferredTime', v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Anything else we should know?">
              <Textarea rows={3} value={data.notes || ''} onChange={e => upd('notes', e.target.value)} placeholder="Timing, permit status, board deadlines, etc." />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting…</> : 'Request Scoping Call'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">We'll email you to confirm the time. No obligation, no sales pitch.</p>
          </form>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}{required && <span className="ml-1 text-primary">*</span>}</Label>
      {children}
    </div>
  );
}
function Feature({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}
