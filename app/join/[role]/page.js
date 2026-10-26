'use client';

// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §6 (D-Screens §03).
// Data-driven wizard (lib/role-schemas.js) — restyled to D tokens, logic
// untouched. The role a visitor picks here is a request, not a grant: the
// server (SECURITY_HARDENING.md S2) validates `role` against its own
// allowlist regardless of what this form sends.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ROLE_SCHEMAS } from '@/lib/role-schemas';
import DNav from '@/components/redesign/d-nav';
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
  const [result, setResult] = useState(null);

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
        <DNav />
        <div className="bg-[var(--d-forest)] text-[var(--d-ivory)]">
          <div className="container py-24 text-center">
            <h1 className="text-2xl font-bold">Unknown role: {role}</h1>
            <Link href="/join" className="mt-6 inline-flex h-11 items-center rounded-full bg-[var(--d-brick)] px-5 text-sm font-semibold">Back to role selection</Link>
          </div>
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
      if (existingUser) {
        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.fullName, phone: data.phone, company: data.company, profile: data })
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Could not save profile'); setLoading(false); return; }
        toast.success('Profile saved.');
        router.push('/dashboard');
        return;
      }
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          name: data.fullName,
          phone: data.phone,
          company: data.company,
          role,
          profile: data
        })
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Signup failed'); setLoading(false); return; }
      setResult(d);
      setStep(schema.steps.length);
    } catch (e) {
      toast.error('Something went wrong');
      setLoading(false);
    }
  }

  // Success screen
  if (step === schema.steps.length) {
    return (
      <>
        <DNav />
        <div className="bg-[var(--d-forest)] text-[var(--d-ivory)]">
          <div className="container flex min-h-[60vh] items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--d-brick)]/15">
                <CheckCircle2 className="h-8 w-8" style={{ color: 'var(--d-brick-lo)' }} />
              </div>
              <h1 className="mt-6 text-3xl font-bold" style={{ fontFamily: 'var(--font-archivo)' }}>{result?.status === 'pending' ? 'Application received.' : 'Check your email.'}</h1>
              <p className="mx-auto mt-2 max-w-md text-[var(--d-mist)]">
                We emailed a one-time sign-in link to <strong className="text-[var(--d-ivory)]">{data.email}</strong>.
                {result?.status === 'pending' && ' Our team verifies licenses and insurance before granting project access — you can sign in any time to check your status.'}
              </p>
              {result && !result.emailSent && !result.devLink && (
                <p className="mx-auto mt-3 max-w-md text-xs text-[var(--d-sage)]">If the email doesn't arrive, request a new link from the sign-in page.</p>
              )}
              {result?.devLink && <a href={result.devLink} className="mt-4 inline-block text-xs underline" style={{ color: 'var(--d-brick-lo)' }}>Dev only: open sign-in link</a>}
              <div className="mt-6"><Link href="/login" className="inline-flex h-11 items-center rounded-full border border-[var(--d-hair)] px-5 text-sm font-semibold">Go to sign in</Link></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DNav />
      <div className="bg-[var(--d-forest)] pb-28 text-[var(--d-ivory)]">
        <div className="container max-w-2xl py-12">
          <div className="mb-8">
            <Link href="/join" className="inline-flex items-center gap-1 text-sm text-[var(--d-mist)] hover:text-[var(--d-ivory)]"><ArrowLeft className="h-3.5 w-3.5" /> Choose a different role</Link>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>{schema.headline || `${schema.label} ${schema.mode === 'instant' ? 'Profile' : 'Application'}`}</div>
              <h1 className="mt-1 text-2xl font-bold" style={{ fontFamily: 'var(--font-archivo)' }}>{currentStep.title}</h1>
              {schema.subhead && step === 0 && <p className="mt-2 text-sm text-[var(--d-mist)]">{schema.subhead}</p>}
              <div className="mt-4 text-xs text-[var(--d-sage)]">Step {step + 1} of {schema.steps.length}</div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--d-forest-2)]">
              <div className="h-full rounded-full bg-[var(--d-brick)] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--d-hair)] bg-[var(--d-forest-2)] p-6 md:p-8">
            <div className="space-y-5">
              {currentStep.fields.map(field => (
                <FieldRow key={field.name} field={field} value={data[field.name]} onChange={v => update(field.name, v)} />
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-[var(--d-hair)] pt-6">
              <button
                onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0}
                className="inline-flex items-center text-sm text-[var(--d-mist)] hover:text-[var(--d-ivory)] disabled:opacity-40"
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </button>
              <button
                onClick={next} disabled={loading}
                className="inline-flex h-12 items-center rounded-full bg-[var(--d-brick)] px-6 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : (
                  step === schema.steps.length - 1
                    ? <>{schema.mode === 'instant' ? 'Create Profile' : 'Submit Application'} <Sparkles className="ml-2 h-4 w-4" /></>
                    : <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FieldRow({ field, value, onChange }) {
  const id = 'f-' + field.name;
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('kind', 'insurance');
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    setUploading(false);
    if (res.ok) onChange(data.url);
    else { onChange(''); toast.error(data.error || 'Upload failed'); }
  }

  const inputClass = 'w-full rounded-md border border-[var(--d-hair)] bg-[var(--d-forest)] px-3 py-2 text-sm text-[var(--d-ivory)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-brick)]';

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-[var(--d-ivory)]">
        {field.label}{field.required && <span className="ml-1" style={{ color: 'var(--d-brick-lo)' }}>*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea id={id} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={3} className={inputClass} />
      ) : field.type === 'select' ? (
        <select id={id} value={value || ''} onChange={e => onChange(e.target.value)} className={inputClass}>
          <option value="">Select…</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === 'file' ? (
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[var(--d-hair)] bg-[var(--d-forest)] px-3 py-4 text-sm text-[var(--d-mist)] hover:border-[var(--d-brick)] hover:text-[var(--d-ivory)]">
            <input id={id} type="file" accept={field.accept || '.pdf,.png,.jpg,.jpeg'} onChange={handleFile} className="hidden" />
            {uploading ? 'Uploading…' : value ? `Uploaded: ${value.split('/').pop()}` : 'Click to upload (PDF, PNG or JPG, max 10 MB)'}
          </label>
          {value && <div className="text-xs" style={{ color: 'var(--d-ok)' }}>✓ File attached</div>}
        </div>
      ) : (
        <input id={id} type={field.type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={inputClass} />
      )}
    </div>
  );
}
