import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Activity, 
  History, 
  Dumbbell, 
  XCircle,
  Upload
} from 'lucide-react';
import { 
  collection, 
  collectionGroup, 
  query, 
  onSnapshot, 
  orderBy, 
  limit, 
  where, 
  doc, 
  setDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole, Gym } from '../types';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';
import { Logo } from './Logo';

interface SuperStaffDashboardProps {
  user: UserProfile;
  setActiveTab: (tab: string) => void;
}

const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

export const SuperStaffDashboard = ({ user, setActiveTab }: SuperStaffDashboardProps) => {
  const [gyms, setGyms] = useState<UserProfile[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [todayCheckins, setTodayCheckins] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [apiError, setApiError] = useState<{ message: string, link: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    gymName: '',
    themeColor: '#00FF00',
    logoUrl: ''
  });

  useEffect(() => {
    // Fetch Gyms
    const qGyms = query(collection(db, 'users'), where('role', '==', UserRole.GYM_STAFF));
    const unsubGyms = onSnapshot(qGyms, (snapshot) => {
      setGyms(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    // Fetch Global Stats
    const qMembers = query(collectionGroup(db, 'members'));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      setTotalMembers(snapshot.size);
    });

    const qCheckins = query(collection(db, 'checkins'), orderBy('timestamp', 'desc'), limit(1000));
    const unsubCheckins = onSnapshot(qCheckins, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      setTotalCheckins(snapshot.size);
      const today = new Date().toLocaleDateString();
      setTodayCheckins(docs.filter(d => new Date(d.timestamp).toLocaleDateString() === today).length);
    });

    return () => {
      unsubGyms();
      unsubMembers();
      unsubCheckins();
    };
  }, []);

  const handleAddGym = async () => {
    if (!formData.name || !formData.email || !formData.password || !formData.gymName) {
      setStatus('All fields are required');
      return;
    }
    if (formData.password.length < 6) {
      setStatus('Password must be at least 6 characters long');
      return;
    }
    try {
      setIsSaving(true);
      
      const response = await fetch('/api/staff/bulk-create-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: [{
            email: formData.email,
            password: formData.password,
            name: formData.name
          }]
        })
      });
      const result = await response.json();
      if (result.failed?.length > 0) {
        if (result.failed[0].isApiDisabled) {
          setApiError({ message: result.failed[0].error, link: result.failed[0].apiLink });
        }
        throw new Error(result.failed[0].error);
      }
      const gymId = result.successful[0].uid;

      const gymData: UserProfile = {
        uid: gymId,
        name: formData.name,
        email: formData.email,
        role: UserRole.GYM_STAFF,
        gymId: gymId,
        status: 'active',
        createdAt: Date.now(),
        gymConfig: {
          name: formData.gymName,
          themeColor: formData.themeColor,
          logoUrl: formData.logoUrl
        }
      };

      const newGym: Gym = {
        id: gymId,
        name: formData.gymName,
        slug: formData.gymName.toLowerCase().replace(/\s+/g, '-'),
        themeColor: formData.themeColor,
        active: true,
        memberCount: 0,
        capacity: 100,
        currentOccupancy: 0,
        ownerId: gymId,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', gymId), gymData);
      await setDoc(doc(db, 'gyms', gymId), newGym);
      setIsAdding(false);
      setFormData({ name: '', email: '', password: '', gymName: '', themeColor: '#00FF00', logoUrl: '' });
      setStatus('Gym added successfully');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCleanupUsers = async () => {
    if (!window.confirm("Are you sure you want to delete all users except yourself? This cannot be undone.")) return;
    
    try {
      setIsSaving(true);
      const response = await fetch('/api/admin/cleanup-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ superAdminEmail: user.email })
      });
      const result = await response.json();
      if (result.error) {
        if (result.error.includes('Identity Toolkit API')) {
          setApiError({ 
            message: result.error, 
            link: `https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${firebaseProjectId}` 
          });
        }
        throw new Error(result.error);
      }
      setStatus(result.message);
      setTimeout(() => setStatus(null), 5000);
    } catch (err: any) {
      setStatus(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight">Gym Management</h2>
        <div className="flex flex-col xs:flex-row items-center gap-3 w-full sm:w-auto">
          <Button variant="danger" onClick={handleCleanupUsers} icon={Trash2} loading={isSaving} className="w-full sm:w-auto py-3.5 px-6 order-2 sm:order-1">Cleanup All</Button>
          <Button variant="primary" onClick={() => setIsAdding(true)} icon={Plus} className="w-full sm:w-auto py-3.5 px-6 order-1 sm:order-2">Add New Gym</Button>
        </div>
      </div>

      {status && (
        <div className="p-4 bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-xl text-[var(--primary)] text-sm font-bold">
          {status}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <Card className="p-3 md:p-6 flex flex-col items-center justify-center text-center space-y-1 md:space-y-2 border-[var(--primary)]/20 bg-[var(--primary)]/5">
          <Users className="w-5 h-5 md:w-8 md:h-8 text-[var(--primary)]" />
          <div>
            <p className="text-[8px] md:text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Total Members</p>
            <p className="text-lg md:text-3xl font-black italic">{totalMembers}</p>
          </div>
        </Card>
        <Card className="p-3 md:p-6 flex flex-col items-center justify-center text-center space-y-1 md:space-y-2 border-blue-500/20 bg-blue-500/5">
          <Activity className="w-5 h-5 md:w-8 md:h-8 text-blue-500" />
          <div>
            <p className="text-[8px] md:text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Today's Check-ins</p>
            <p className="text-lg md:text-3xl font-black italic">{todayCheckins}</p>
          </div>
        </Card>
        <Card className="p-3 md:p-6 flex flex-col items-center justify-center text-center space-y-1 md:space-y-2 border-purple-500/20 bg-purple-500/5">
          <History className="w-5 h-5 md:w-8 md:h-8 text-purple-500" />
          <div>
            <p className="text-[8px] md:text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Total Check-ins</p>
            <p className="text-lg md:text-3xl font-black italic">{totalCheckins}</p>
          </div>
        </Card>
        <Card className="p-3 md:p-6 flex flex-col items-center justify-center text-center space-y-1 md:space-y-2 border-orange-500/20 bg-orange-500/5">
          <Dumbbell className="w-5 h-5 md:w-8 md:h-8 text-orange-500" />
          <div>
            <p className="text-[8px] md:text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Total Gyms</p>
            <p className="text-lg md:text-3xl font-black italic">{gyms.length}</p>
          </div>
        </Card>
      </div>

      {apiError && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-4 relative">
          <button
            onClick={() => setApiError(null)}
            className="absolute top-4 right-4 text-red-500/50 hover:text-red-500 transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 text-red-500">
            <XCircle className="w-6 h-6" />
            <h3 className="font-black uppercase italic tracking-tight text-lg">Action Required: Enable Firebase Auth API</h3>
          </div>
          <p className="text-sm text-red-200/80 leading-relaxed">
            {apiError.message}
            <br /><br />
            <strong>Important:</strong> If you've already enabled the API, please ensure it's enabled for the specific project mentioned above. You may also need to click "Get Started" in the <a href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication`} target="_blank" className="underline font-bold text-white">Firebase Auth Console</a> and enable <strong>Email/Password</strong> sign-in.
          </p>
          <a
            href={apiError.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-red-500 text-white px-6 py-3 rounded-xl font-black uppercase italic tracking-widest text-xs hover:bg-red-600 transition-all"
          >
            Enable API Now
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gyms.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <p className="text-[var(--text-muted)] italic">No gyms registered yet.</p>
          </div>
        ) : (
          gyms.map(gym => (
            <Card key={gym.uid} className="group hover:border-[var(--primary)]/30 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {gym.gymConfig?.logoUrl ? (
                    <img src={gym.gymConfig.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-white/10" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                      <Dumbbell className="w-6 h-6 text-[var(--text-muted)]" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{gym.gymConfig?.name}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{gym.email}</p>
                  </div>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: gym.gymConfig?.themeColor }} />
              </div>
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Admin: {gym.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--primary)] font-bold uppercase">{gym.status}</span>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={isAdding}
        onClose={() => setIsAdding(false)}
        title="Register New Gym"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAdding(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={handleAddGym} loading={isSaving} className="flex-1">Create Gym</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Admin Name</label>
              <input
                type="text"
                placeholder="Manager Name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
             <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Admin Password</label>
              <input
                type="password"
                placeholder="Min 6 chars"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Admin Email</label>
            <input
              type="email"
              placeholder="manager@gym.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
           <h4 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-[var(--primary)]">Gym Customization</h4>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Gym Name</label>
              <input
                type="text"
                placeholder="e.g. Iron Core Fitness"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none"
                value={formData.gymName}
                onChange={e => setFormData({ ...formData, gymName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Theme Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="w-12 h-11 bg-transparent rounded-lg cursor-pointer border-none"
                    value={formData.themeColor}
                    onChange={e => setFormData({ ...formData, themeColor: e.target.value })}
                  />
                  <input
                    type="text"
                     className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:neon-border outline-none"
                    value={formData.themeColor}
                    onChange={e => setFormData({ ...formData, themeColor: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Gym Logo</label>
                <div className="flex items-center gap-4">
                  {formData.logoUrl && (
                    <img src={formData.logoUrl} alt="Logo Preview" className="w-12 h-12 rounded-lg object-cover bg-white/5 border border-white/10" />
                  )}
                  <div className="flex-1">
                    <label className="relative cursor-pointer">
                      <div className="w-full bg-white/5 border border-white/10 border-dashed rounded-xl px-4 py-2 flex flex-col items-center justify-center gap-1 hover:border-[var(--primary)] transition-all">
                        <Upload className="w-4 h-4 opacity-40" />
                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-center">Click to Upload</span>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                             const reader = new FileReader();
                             reader.onloadend = () => {
                               setFormData(prev => ({...prev, logoUrl: reader.result as string}));
                             };
                             reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
