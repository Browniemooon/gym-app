import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Trash2 
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, MembershipPlan } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';

interface PlanManagementProps {
  user: UserProfile;
}

export const PlanManagement = ({ user }: PlanManagementProps) => {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', price: 0, durationDays: 30, description: '' });

  useEffect(() => {
    if (!user.gymId) return;
    const q = query(collection(db, `gyms/${user.gymId}/membershipPlans`), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MembershipPlan)));
    });
  }, [user.gymId]);

  const handleAddPlan = async () => {
    if (!formData.name || formData.price <= 0 || formData.durationDays <= 0) {
      setStatus('Please fill all required fields correctly');
      return;
    }
    try {
      const planId = `plan_${Math.random().toString(36).slice(2, 11)}`;
      await setDoc(doc(db, `gyms/${user.gymId}/membershipPlans`, planId), {
        ...formData,
        id: planId,
        gymId: user.gymId,
        createdAt: Date.now()
      });
      setIsAdding(false);
      setFormData({ name: '', price: 0, durationDays: 30, description: '' });
      setStatus('Plan added successfully');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus(err.message);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!window.confirm('Delete this plan?')) return;
    try {
      await deleteDoc(doc(db, `gyms/${user.gymId}/membershipPlans`, id));
      setStatus('Plan deleted');
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-[var(--primary)]" /> Membership Plans
        </h2>
        <Button variant="primary" onClick={() => setIsAdding(true)} icon={Plus}>Add Plan</Button>
      </div>

      {status && <p className="text-xs font-bold text-[var(--primary)] uppercase tracking-widest">{status}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(plan => (
          <Card key={plan.id} className="relative group border border-white/5 hover:border-[var(--primary)]/30 transition-all">
            <button 
              onClick={() => handleDeletePlan(plan.id)}
              className="absolute top-4 right-4 p-2 text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tight">{plan.name}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">{plan.durationDays} Days Duration</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black italic tracking-tighter text-[var(--primary)]">₹{plan.price}</span>
                <span className="text-xs uppercase font-bold opacity-50">/ Plan</span>
              </div>
              {plan.description && <p className="text-xs opacity-70 leading-relaxed">{plan.description}</p>}
            </div>
          </Card>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
            <CreditCard className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="font-bold text-white/40 uppercase italic tracking-widest text-xs">No plans created yet</p>
          </div>
        )}
      </div>

      <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} title="Create Membership Plan">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Plan Name</label>
            <input 
              type="text" 
              placeholder="e.g. Monthly Pro" 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Price (INR)</label>
              <input 
                type="number" 
                placeholder="0.00" 
                value={formData.price} 
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Duration (Days)</label>
              <input 
                type="number" 
                placeholder="30" 
                value={formData.durationDays} 
                onChange={e => setFormData({ ...formData, durationDays: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Description (Optional)</label>
            <textarea 
              placeholder="What's included in this plan?" 
              value={formData.description} 
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] min-h-[100px]"
            />
          </div>
          <Button variant="primary" onClick={handleAddPlan} className="w-full" icon={Plus}>Create Plan</Button>
        </div>
      </Modal>
    </div>
  );
};
