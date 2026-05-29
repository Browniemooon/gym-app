import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Trash2, 
  Save, 
  Dumbbell,
  Upload
} from 'lucide-react';
import { 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole, Gym } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface GymSettingsProps {
  user: UserProfile;
}

export const GymSettings = ({ user }: GymSettingsProps) => {
  const [gym, setGym] = useState<Gym | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const targetId = user.gymId || (user.role === UserRole.SUPER_STAFF ? 'system' : user.uid);
    if (!targetId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'gyms', targetId), (snapshot) => {
      if (snapshot.exists()) {
        setGym({ id: snapshot.id, ...snapshot.data() } as Gym);
      } else {
        setGym(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('Settings fetch error:', error);
      setLoading(false);
      setStatus('Failed to load settings');
    });

    return () => unsub();
  }, [user.gymId, user.uid, user.role]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gym) return;
    try {
      setIsSaving(true);
      const targetId = user.gymId || (user.role === UserRole.SUPER_STAFF ? 'system' : user.uid);
      await updateDoc(doc(db, 'gyms', targetId), {
        name: gym.name,
        themeColor: gym.themeColor,
        logoUrl: gym.logoUrl,
        paymentConfig: gym.paymentConfig || {}
      });
      
      // Update local storage/state for theme if needed
      document.documentElement.style.setProperty('--primary', gym.themeColor);
      
      setStatus('Settings updated successfully');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error('Settings update error:', err);
      setStatus('Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="py-12 text-center opacity-40 uppercase font-black italic tracking-widest text-xs">Loading Settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tight flex items-center gap-2 md:gap-3">
          <Settings className="w-6 h-6 md:w-8 md:h-8 text-[var(--primary)]" /> Portal Settings
        </h2>
        {status && <span className="text-xs font-bold text-[var(--primary)]">{status}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <form onSubmit={handleUpdateSettings} className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-60 mb-4">Branding & Theme</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Gym / Portal Name</label>
                <input 
                  type="text" 
                  value={gym?.name || ''} 
                  onChange={e => setGym(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:neon-border" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Theme Color</label>
                <div className="flex gap-4 items-center">
                  <input 
                    type="color" 
                    value={gym?.themeColor || '#00FF00'} 
                    onChange={e => setGym(prev => prev ? {...prev, themeColor: e.target.value} : null)}
                    className="w-12 h-12 rounded-lg bg-transparent border-none cursor-pointer" 
                  />
                  <input 
                    type="text" 
                    value={gym?.themeColor || '#00FF00'} 
                    onChange={e => setGym(prev => prev ? {...prev, themeColor: e.target.value} : null)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono outline-none" 
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Portal Logo</label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    {gym?.logoUrl && (
                      <img src={gym.logoUrl} alt="Logo Preview" className="w-16 h-16 rounded-xl object-cover bg-white/5 border border-white/10" />
                    )}
                    <div className="flex-1">
                      <label className="relative group cursor-pointer text-center">
                        <div className="w-full bg-white/5 border border-white/10 border-dashed rounded-xl px-4 py-8 flex flex-col items-center justify-center gap-2 group-hover:border-[var(--primary)] transition-all">
                          <Upload className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-all" />
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Click to Upload Logo</span>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 800000) {
                                alert("Logo image too large. Please use a file smaller than 800KB.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setGym(prev => prev ? {...prev, logoUrl: reader.result as string} : null);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Or Paste Image URL</span>
                    <input 
                      type="text" 
                      placeholder="https://example.com/logo.png"
                      value={gym?.logoUrl?.startsWith('data:') ? '' : (gym?.logoUrl || '')} 
                      onChange={e => setGym(prev => prev ? {...prev, logoUrl: e.target.value} : null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] outline-none focus:neon-border" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-60 mb-4">Payment Configuration</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">UPI ID (for Direct Payments)</label>
                  <input 
                    type="text" 
                    value={gym?.paymentConfig?.upiId || ''} 
                    onChange={e => setGym(prev => prev ? {...prev, paymentConfig: {...(prev.paymentConfig || {type: 'upi'}), upiId: e.target.value}} : null)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:neon-border" 
                    placeholder="gymname@okaxis"
                  />
                  <p className="text-[9px] opacity-40 mt-1 italic">Members will use this ID to pay for renewals via UPI apps (GPay, PhonePe, etc.)</p>
                </div>
              </div>
            </div>

            <Button type="submit" variant="primary" loading={isSaving} icon={Save} className="w-full">
              Save All Settings
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 bg-[var(--primary)]/5 border-[var(--primary)]/20">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Live Preview</h3>
            <div className="p-6 bg-black rounded-2xl border border-white/10 space-y-6">
              <div className="flex items-center gap-3">
                {gym?.logoUrl ? (
                  <img src={gym.logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-[var(--primary)]" style={{ color: gym?.themeColor }} />
                  </div>
                )}
                <div>
                  <p className="font-black uppercase italic tracking-tighter" style={{ color: gym?.themeColor }}>{gym?.name || 'Your Gym Name'}</p>
                  <p className="text-[8px] uppercase tracking-widest opacity-40">Member Portal</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)] w-2/3" style={{ backgroundColor: gym?.themeColor }} />
                </div>
                <div className="flex justify-between">
                   <div className="h-8 w-20 bg-white/5 rounded-lg" />
                   <div className="h-8 w-20 rounded-lg" style={{ backgroundColor: gym?.themeColor }} />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-red-500/20 bg-red-500/5">
             <h3 className="text-sm font-bold uppercase tracking-widest text-red-500 mb-4">Danger Zone</h3>
             <div className="space-y-4">
               <p className="text-xs opacity-60">Resetting theme will restore original branding colors.</p>
               <Button 
                variant="ghost" 
                onClick={() => setGym(prev => prev ? {...prev, themeColor: '#00FF00'} : null)}
                className="text-red-500 hover:bg-red-500/10 border-red-500/20 text-[10px]"
               >
                 Reset Theme to Default
               </Button>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
