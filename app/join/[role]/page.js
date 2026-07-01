'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ROLE_SCHEMAS } from '@/lib/role-schemas';
import SiteNav from '@/components/site-nav';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function OnboardingWizard() {
  const params = useParams();
  const router = useRouter();
  const role = params.role;
  const schema = ROLE_SCHEMAS[role];
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [existingUser, setExistingUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user) {
        setExistingUser(d.user);
        setData({
          fullName: d.user.name,
          email: d.user.email,
          phone: d.user.phone,
          company: d.user.company,
          ...(d.user.profile || {})
        });
      }
    }).catch(() => {});
  }, []);

  if (!schema) {
    return (
      <>
        <SiteNav />
        <div className="container py-24 text-center">
          <h1 className="text-2xl font-bold">Unknown role: {role}</h1>
          <Button asChild className="mt-6"><Link href="/join">Back to role selection</Link></Button>
        </div>
      </>
    );
  }

  const currentStep = schema.steps[step];
  const progress = ((step + 1) / (schema.steps.length + 1)) * 100;

  function update(name, val) { setData(d => ({ ...d, [name]: val })); }

  function validateStep() {
    for (const f of currentStep.fields) {
      if (f.required && !data[f.name]) {
        toast.error(`"${f.label}" is required`);
        return false;
      }
    }
    return true;
  }

  async function next() {
    if (!validateStep()) return;
    if (step < schema.steps.length - 1) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    await submit();
  }

  async function submit() {
    setLoading(true);
    try {
      let user = existingUser;
      if (!user) {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            name: data.fullName,
            phone: data.phone,
            company: data.company,
            role
          })
        });
        const d = await res.json();
        if (!res.ok) { toast.error(d.error || 'Signup failed'); setLoading(false); return; }
        user = d.user;
      }
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.fullName,
          phone: data.phone,
          company: data.company,
          profile: data
        })
      });
      toast.success('Profile complete — welcome aboard.');
      setStep(schema.steps.length); // show success screen
      setTimeout(() => router.push(`/dashboard/${role}`), 1400);
    } catch (e) {
      toast.error('Something went wrong');
      setLoading(false);
    }
  }

  // Success screen
  if (step === schema.steps.length) {
    return (
      <>
        <SiteNav />
        <div className="container flex min-h-[60vh] items-center justify-center py-16">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mt-6 text-3xl font-bold">You're in.</h1>
            <p className="mt-2 text-muted-foreground">Redirecting to your dashboard…</p>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <div className="container max-w-2xl py-12">
        <div className="mb-8">
          <Link href="/join" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Choose a different role</Link>
          <div className="mt-6 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-primary">{schema.label} Application</div>
              <h1 className="mt-1 text-2xl font-bold">{currentStep.title}</h1>
            </div>
            <div className="text-sm text-muted-foreground">Step {step + 1} of {schema.steps.length}</div>
          </div>
          <Progress value={progress} className="mt-4" />
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="space-y-5">
            {currentStep.fields.map(field => (
              <FieldRow key={field.name} field={field} value={data[field.name]} onChange={v => update(field.name, v)} />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            <Button variant="ghost" onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={next} disabled={loading} size="lg">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : (
                step === schema.steps.length - 1 ? <>Complete <Sparkles className="ml-2 h-4 w-4" /></> : <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

function FieldRow({ field, value, onChange }) {
  const id = 'f-' + field.name;
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-sm">{field.label}{field.required && <span className="ml-1 text-primary">*</span>}</Label>
      {field.type === 'textarea' ? (
        <Textarea id={id} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={3} />
      ) : field.type === 'select' ? (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {field.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input id={id} type={field.type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
    </div>
  );
}
