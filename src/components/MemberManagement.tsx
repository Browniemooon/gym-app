import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Trash2, 
  Edit, 
  UserPlus, 
  History, 
  XCircle,
  Shield,
  Dumbbell
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc, 
  setDoc,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole, CheckIn, MembershipPlan, OperationType } from '../types';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Modal, ConfirmModal } from './ui/Modal';

interface MemberManagementProps {
  user: UserProfile;
}

const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

export const MemberManagement = ({ user }: MemberManagementProps) => {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [memberHistory, setMemberHistory] = useState<CheckIn[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState({ 
    name: '', 
    role: UserRole.MEMBER, 
    phone: '',
    email: '',
    password: '',
    gymName: '',
    themeColor: '#00FF00',
    logoUrl: '',
    membershipPlanId: '',
    membershipExpiresAt: ''
  });
  const [addForm, setAddForm] = useState({ 
    name: '', 
    role: UserRole.MEMBER, 
    phone: '',
    email: '',
    password: '',
    gymName: '',
    themeColor: '#00FF00',
    logoUrl: '',
    membershipPlanId: '',
    membershipExpiresAt: ''
  });
  const [status, setStatus] = useState<string | null>(null);
  const [apiError, setApiError] = useState<{ message: string, link: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [gymPlans, setGymPlans] = useState<MembershipPlan[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user.gymId || user.role !== UserRole.GYM_STAFF) return;
    const q = query(collection(db, `gyms/${user.gymId}/membershipPlans`), orderBy('price', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setGymPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MembershipPlan)));
    });
  }, [user.gymId, user.role]);

  useEffect(() => {
    if (!user.uid) return;

    let qMembers;
    if (user.role === UserRole.SUPER_STAFF) {
      qMembers = query(collection(db, 'users'), where('role', '==', UserRole.GYM_STAFF));
    } else {
      qMembers = query(collection(db, `gyms/${user.gymId}/members`));
    }

    const unsubMembers = onSnapshot(qMembers, 
      (snapshot) => {
        let allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        if (user.role !== UserRole.SUPER_STAFF) {
          allUsers.sort((a, b) => b.createdAt - a.createdAt);
        }
        setMembers(allUsers);
      },
      (error) => {
        console.error('Members snapshot error:', error);
        showStatus('Permission denied: Cannot load members');
      }
    );
    return () => unsubMembers();
  }, [user.uid, user.role, user.gymId]);

  useEffect(() => {
    if (selectedMember) {
      const q = query(
        collection(db, 'checkins'), 
        where('memberId', '==', selectedMember.id || selectedMember.uid),
        where('gymId', '==', user.gymId)
      );
      return onSnapshot(q, 
        (snapshot) => {
          const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn));
          setMemberHistory(history.sort((a, b) => b.timestamp - a.timestamp));
        },
        (error) => {
          console.error('History snapshot error:', error);
          showStatus('Permission denied: Cannot load history');
        }
      );
    }
  }, [selectedMember, user.gymId]);

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3000);
  };

  const handleDeleteMember = async () => {
    if (!confirmDelete) return;
    try {
      setIsDeleting(true);
      const path = user.role === UserRole.SUPER_STAFF ? 'users' : `gyms/${user.gymId}/members`;
      await deleteDoc(doc(db, path, confirmDelete));
      showStatus('Member deleted');
      setConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete member:', err);
      showStatus('Error deleting member');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditMember = (member: UserProfile) => {
    setEditForm({ 
      name: member.name, 
      role: member.role, 
      phone: member.phone || '',
      email: member.email || '',
      password: '',
      gymName: member.gymConfig?.name || '',
      themeColor: member.gymConfig?.themeColor || '#00FF00',
      logoUrl: member.gymConfig?.logoUrl || '',
      membershipPlanId: member.membershipPlanId || '',
      membershipExpiresAt: member.membershipExpiresAt ? new Date(member.membershipExpiresAt).toISOString().split('T')[0] : ''
    });
    setSelectedMember(member);
    setIsEditing(true);
  };

  const saveMemberChanges = async () => {
    if (!selectedMember) return;
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      showStatus('Name and Phone are required');
      return;
    }
    try {
      setIsSaving(true);
      const updateData: any = {
        name: editForm.name,
        role: editForm.role,
        phone: editForm.phone,
        email: editForm.email,
        membershipPlanId: editForm.membershipPlanId || null,
        membershipExpiresAt: editForm.membershipExpiresAt ? new Date(editForm.membershipExpiresAt).getTime() : null
      };

      if (editForm.role === UserRole.GYM_STAFF) {
        updateData.gymConfig = {
          name: editForm.gymName || editForm.name,
          themeColor: editForm.themeColor,
          logoUrl: editForm.logoUrl
        };
      }

      const path = user.role === UserRole.SUPER_STAFF ? 'users' : `gyms/${user.gymId}/members`;
      await updateDoc(doc(db, path, selectedMember.uid), updateData);
      setIsEditing(false);
      setSelectedMember(null);
      showStatus('Changes saved');
    } catch (err) {
      console.error('Failed to update member:', err);
      showStatus('Error saving changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!addForm.name.trim() || !addForm.phone.trim()) {
      showStatus('Name and Phone are required');
      return;
    }
    if (addForm.role === UserRole.GYM_STAFF && (!addForm.email || !addForm.password)) {
      showStatus('Email and Password are required for Staff');
      return;
    }
    if (addForm.password && addForm.password.length < 6) {
      showStatus('Password must be at least 6 characters long');
      return;
    }

    try {
      setIsSaving(true);
      let memberId = `mem_${Math.random().toString(36).slice(2, 11)}`;
      
      if (addForm.role === UserRole.GYM_STAFF) {
        const response = await fetch('/api/staff/bulk-create-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            users: [{
              email: addForm.email,
              password: addForm.password,
              name: addForm.name,
              phone: addForm.phone
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
        memberId = result.successful[0].uid;
      }

      const userData: any = {
        name: addForm.name,
        phone: addForm.phone,
        email: addForm.email || '',
        role: addForm.role,
        status: 'active',
        createdAt: Date.now(),
        uid: memberId,
        id: memberId,
        membershipPlanId: addForm.membershipPlanId || null,
        membershipExpiresAt: addForm.membershipExpiresAt ? new Date(addForm.membershipExpiresAt).getTime() : null,
        gymId: user.role === UserRole.GYM_STAFF ? user.gymId : (addForm.role === UserRole.GYM_STAFF ? memberId : 'system')
      };

      if (addForm.role === UserRole.GYM_STAFF) {
        userData.gymConfig = {
          name: addForm.gymName || addForm.name,
          themeColor: addForm.themeColor,
          logoUrl: addForm.logoUrl
        };
      }

      const path = user.role === UserRole.SUPER_STAFF ? 'users' : `gyms/${user.gymId}/members`;
      await setDoc(doc(db, path, memberId), userData);
      setIsAdding(false);
      setAddForm({ 
        name: '', 
        role: UserRole.MEMBER, 
        phone: '',
        email: '',
        password: '',
        gymName: '',
        themeColor: '#00FF00',
        logoUrl: '',
        membershipPlanId: '',
        membershipExpiresAt: ''
      });
      showStatus('User added');
    } catch (err: any) {
      showStatus(err.message || 'Error adding user');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black uppercase italic tracking-tight">Member Management</h2>
          {status && <span className="text-xs font-bold text-[var(--primary)]">{status}</span>}
        </div>
        <Button variant="primary" onClick={() => setIsAdding(true)} icon={UserPlus}>
          Add User
        </Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-4">
          <div className="space-y-3">
            {members.length === 0 ? (
              <p className="text-center py-12 text-[var(--text-muted)] italic">No members found</p>
            ) : (
              members.map(member => (
                <div key={member.uid} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all gap-4">
                   <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-lg shrink-0" style={{ color: member.gymConfig?.themeColor || 'var(--primary)' }}>
                      {member.name[0]}
                    </div>
                    <div>
                      <p className="font-bold">{member.name}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">PHONE: {member.phone}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/5" style={{ color: member.gymConfig?.themeColor || 'var(--primary)' }}>{member.role}</span>
                        {member.membershipExpiresAt && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
                            <span className={cn(
                              "text-[10px] font-bold",
                              member.membershipExpiresAt < Date.now() ? "text-red-500" : "text-green-500"
                            )}>
                              EXP: {new Date(member.membershipExpiresAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end sm:justify-start border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5">
                    <button onClick={() => setSelectedMember(member)} title="View History" className="p-2 text-[var(--text-muted)] hover:text-white transition-colors"><History className="w-5 h-5" /></button>
                    <button onClick={() => handleEditMember(member)} title="Edit User" className="p-2 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"><Edit className="w-5 h-5" /></button>
                    <button onClick={() => setConfirmDelete(member.uid)} title="Delete User" className="p-2 text-[var(--text-muted)] hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-6">
          {selectedMember && !isEditing && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">History: {selectedMember.name}</h3>
                <button onClick={() => setSelectedMember(null)} className="text-xs text-[var(--text-muted)] hover:text-white">Close</button>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {memberHistory.length === 0 ? (
                  <p className="text-center py-8 text-xs text-[var(--text-muted)] italic">No history available</p>
                ) : (
                  memberHistory.map(ci => (
                    <div key={ci.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                      <div>
                        <p className="text-xs font-bold">{ci.day || new Date(ci.timestamp).toLocaleDateString()}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{ci.time || new Date(ci.timestamp).toLocaleTimeString()}</p>
                      </div>
                      <span className={cn("text-[9px] px-2 py-0.5 rounded-full uppercase font-bold", ci.status === 'approved' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}>{ci.status}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          <Card className="bg-[var(--primary)]/5 border-[var(--primary)]/20">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="text-sm font-bold uppercase tracking-tight italic">Quick Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-1">Total Users</p>
                <p className="text-xl font-black italic">{members.length}</p>
              </div>
              <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                 <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-1">Active Now</p>
                 <p className="text-xl font-black italic">
                   {members.filter(m => m.membershipExpiresAt && m.membershipExpiresAt > Date.now()).length}
                 </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Add/Edit Modals would go here if needed, or inline for simplicity as in original */}
      <Modal 
        isOpen={isAdding} 
        onClose={() => setIsAdding(false)} 
        title="Add New User"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAdding(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={handleAddMember} loading={isSaving} className="flex-1">Add User</Button>
          </>
        }
      >
         <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest opacity-60">Full Name *</label>
              <input type="text" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest opacity-60">Role *</label>
              <select value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value as UserRole})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none">
                <option value={UserRole.MEMBER}>Member</option>
                <option value={UserRole.GYM_STAFF}>Gym Portal/Staff</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest opacity-60">Phone Number *</label>
            <input type="tel" value={addForm.phone} onChange={e => setAddForm({...addForm, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none" />
          </div>

          {addForm.role === UserRole.GYM_STAFF && (
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest opacity-60">Staff Email *</label>
                <input type="email" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest opacity-60">Password *</label>
                <input type="password" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none" />
              </div>
            </div>
          )}

          {addForm.role === UserRole.MEMBER && gymPlans.length > 0 && (
             <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-60">Membership Plan</label>
                  <select 
                    value={addForm.membershipPlanId} 
                    onChange={e => {
                      const plan = gymPlans.find(p => p.id === e.target.value);
                      if (plan) {
                        const expiry = new Date(Date.now() + plan.durationDays * 86400000).toISOString().split('T')[0];
                        setAddForm({...addForm, membershipPlanId: plan.id, membershipExpiresAt: expiry});
                      }
                    }}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                  >
                    <option value="">Select a plan</option>
                    {gymPlans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-60">Expiry Date</label>
                  <input type="date" value={addForm.membershipExpiresAt} onChange={e => setAddForm({...addForm, membershipExpiresAt: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none" />
                </div>
             </div>
          )}
        </div>
      </Modal>

      <Modal 
        isOpen={isEditing} 
        onClose={() => setIsEditing(false)} 
        title="Edit User"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditing(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={saveMemberChanges} loading={isSaving} className="flex-1">Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest opacity-60">Full Name</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none" />
            </div>
             <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest opacity-60">Phone</label>
              <input type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none" />
            </div>
          </div>
          
           {selectedMember?.role === UserRole.MEMBER && gymPlans.length > 0 && (
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-60">Plan</label>
                  <select 
                    value={editForm.membershipPlanId} 
                    onChange={e => setEditForm({...editForm, membershipPlanId: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                  >
                    <option value="">No Plan</option>
                    {gymPlans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-60">Expiry</label>
                  <input type="date" value={editForm.membershipExpiresAt} onChange={e => setEditForm({...editForm, membershipExpiresAt: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none" />
                </div>
             </div>
           )}
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!confirmDelete} 
        onClose={() => setConfirmDelete(null)} 
        onConfirm={handleDeleteMember}
        title="Delete User"
        message="Are you sure you want to remove this user? This will permanently delete their account and history."
        loading={isDeleting}
      />
    </div>
  );
};
