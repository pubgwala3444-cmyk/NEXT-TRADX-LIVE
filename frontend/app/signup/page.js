'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QuotexLogo from '@/components/QuotexLogo';
import { api, setToken, setStoredUser } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const r = await api.signup(email, password, name);
      setToken(r.token); setStoredUser(r.user);
      toast.success('Account created. Welcome!');
      router.push('/trade');
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0c1015] grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-[#0a1d18] to-[#0c1015] relative overflow-hidden">
        <div className="absolute inset-0 qx-bg-grid opacity-30" />
        <Link href="/" className="relative"><QuotexLogo /></Link>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight mb-4">$10,000 Demo<br/><span className="text-[#00b97a]">Free — No Deposit Required</span></h1>
          <p className="text-white/60 max-w-md">Sign up takes 30 seconds. Start practicing or switch to live in one click.</p>
        </div>
        <div className="relative text-white/40 text-xs">© 2025 Quotex. All rights reserved.</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-[#11161e] border-white/5">
          <CardHeader>
            <CardTitle className="text-2xl">Sign up</CardTitle>
            <p className="text-sm text-white/50">Create your free trading account.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-white/70">Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="bg-[#0c1015] border-white/10 mt-1.5 h-11" />
              </div>
              <div>
                <Label className="text-white/70">Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} className="bg-[#0c1015] border-white/10 mt-1.5 h-11" type="email" required/>
              </div>
              <div>
                <Label className="text-white/70">Password</Label>
                <Input value={password} onChange={e => setPassword(e.target.value)} className="bg-[#0c1015] border-white/10 mt-1.5 h-11" type="password" required minLength={4}/>
              </div>
              <Button disabled={loading} className="w-full bg-[#00b97a] hover:bg-[#00a86d] h-11 font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Create account'}
              </Button>
            </form>
            <div className="mt-4 text-sm text-white/50 text-center">
              Already have an account? <Link href="/login" className="text-[#00b97a] hover:underline font-semibold">Log in</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
