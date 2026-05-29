import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Trash2, 
  Edit, 
  UserPlus, 
  History, 
  XCircle,
  Shield,
  Upload,
  Check,
  Square
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
  writeBatch,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole, CheckIn, MembershipPlan, OperationType, Gym } from '../types';
import { updateRegistry, deleteFromRegistry } from '../services/authService';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>('');
  const [gymPlans, setGymPlans] = useState<MembershipPlan[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const targetGymId = user.role === UserRole.SUPER_STAFF ? selectedGymId : user.gymId;
    if (!targetGymId) return;
    const q = query(collection(db, `gyms/${targetGymId}/membershipPlans`), orderBy('price', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setGymPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MembershipPlan)));
    });
  }, [user.gymId, user.role, selectedGymId]);

  useEffect(() => {
    if (user.role !== UserRole.SUPER_STAFF) return;
    const q = query(collection(db, 'gyms'));
    return onSnapshot(q, (snapshot) => {
      setGyms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gym)));
    });
  }, [user.role]);

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

  const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.trim();
    const digits = cleaned.replace(/\D/g, '');
    
    if (cleaned.startsWith('+')) {
      return '+' + digits;
    }
    
    let finalDigits = digits;
    if (digits.length === 11 && digits.startsWith('0')) {
      finalDigits = digits.substring(1);
    }
    
    if (finalDigits.length === 10) {
      return '+91' + finalDigits;
    }
    
    return digits ? '+' + digits : '';
  };

  const handleDeleteMember = async () => {
    const isMultiple = confirmDelete === 'multiple';
    const idsToDelete = isMultiple ? Array.from(selectedIds) : (confirmDelete ? [confirmDelete] : []);
    
    if (idsToDelete.length === 0) {
      setConfirmDelete(null);
      return;
    }

    try {
      setIsDeleting(true);
      const batch = writeBatch(db);
      
      idsToDelete.forEach(id => {
        // Find member in state to determine role and gymId
        const member = members.find(m => m.uid === id);
        if (!member) return;

        const isTargetStaff = member.role === UserRole.GYM_STAFF || member.role === UserRole.STAFF || member.role === UserRole.SUPER_STAFF;
        const targetGymId = member.gymId || user.gymId;
        const path = isTargetStaff ? 'users' : `gyms/${targetGymId}/members`;
        
        batch.delete(doc(db, path, id));
        
        // Clean up global registries
        if (member.phone) deleteFromRegistry('phone', member.phone);
        if (member.uid) deleteFromRegistry('uid', member.uid);
      });

      await batch.commit();
      
      showStatus(idsToDelete.length > 1 ? `${idsToDelete.length} users removed` : 'Member removed');
      setConfirmDelete(null);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to delete member(s):', err);
      showStatus('Error deleting: Permission denied or network issue');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map(m => m.uid)));
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
      const normalizedPhone = normalizePhone(editForm.phone);
      const updateData: any = {
        name: editForm.name,
        role: editForm.role,
        phone: normalizedPhone,
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

      const isTargetStaff = editForm.role === UserRole.GYM_STAFF || editForm.role === UserRole.STAFF || editForm.role === UserRole.SUPER_STAFF;
      const targetGymId = selectedMember.gymId || user.gymId;
      const path = isTargetStaff ? 'users' : `gyms/${targetGymId}/members`;
      
      console.log('Saving member to path:', path, 'ID:', selectedMember.uid);
      await updateDoc(doc(db, path, selectedMember.uid), updateData);

      // Update registry if phone changed or for new data
      if (normalizedPhone) {
        await updateRegistry('phone', normalizedPhone, { 
          gymId: targetGymId, 
          memberId: selectedMember.uid, 
          role: editForm.role 
        });
      }

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
      const normalizedPhone = normalizePhone(addForm.phone);
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
              phone: normalizedPhone
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

      const targetGymId = user.role === UserRole.GYM_STAFF 
        ? user.gymId 
        : (addForm.role === UserRole.GYM_STAFF ? memberId : (selectedGymId || 'system'));

      const userData: any = {
        name: addForm.name,
        phone: normalizedPhone,
        email: addForm.email || '',
        role: addForm.role,
        status: 'active',
        createdAt: Date.now(),
        uid: memberId,
        id: memberId,
        membershipPlanId: addForm.membershipPlanId || null,
        membershipExpiresAt: addForm.membershipExpiresAt ? new Date(addForm.membershipExpiresAt).getTime() : null,
        gymId: targetGymId
      };

      if (addForm.role === UserRole.GYM_STAFF) {
        userData.gymConfig = {
          name: addForm.gymName || addForm.name,
          themeColor: addForm.themeColor,
          logoUrl: addForm.logoUrl
        };
      }

      const isStaffToAdd = addForm.role === UserRole.GYM_STAFF || addForm.role === UserRole.STAFF;
      const path = isStaffToAdd ? 'users' : `gyms/${targetGymId}/members`;
      
      await setDoc(doc(db, path, memberId), userData);

      // Update Registry
      if (normalizedPhone) {
        await updateRegistry('phone', normalizedPhone, {
          gymId: targetGymId,
          memberId: memberId,
          role: addForm.role
        });
      }
      if (addForm.role === UserRole.GYM_STAFF && memberId) {
        await updateRegistry('uid', memberId, {
          gymId: targetGymId,
          memberId: memberId,
          role: addForm.role
        });
      }

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
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 ml-4 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">
              <span className="text-[10px] font-black uppercase text-red-500">{selectedIds.size} Selected</span>
              <button 
                onClick={() => setConfirmDelete('multiple')}
                className="text-[10px] font-black uppercase italic tracking-widest text-red-500 hover:underline"
              >
                Delete Selected
              </button>
            </div>
          )}
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
          <div className="flex items-center justify-between px-2 mb-2 sm:mb-4">
            <button 
              onClick={selectAll}
              className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-all flex items-center gap-2.5 py-2"
            >
              <div className={cn(
                "w-4 h-4 sm:w-4 sm:h-4 rounded border flex items-center justify-center transition-all",
                selectedIds.size === members.length && members.length > 0 ? "bg-[var(--primary)] border-[var(--primary)]" : "border-white/20"
              )}>
                {selectedIds.size === members.length && members.length > 0 && <Check className="w-3 h-3 text-black" />}
              </div>
              <span>{selectedIds.size === members.length && members.length > 0 ? "Deselect All" : "Select All"}</span>
            </button>
          </div>
          <div className="space-y-3">
            {members.length === 0 ? (
              <p className="text-center py-12 text-[var(--text-muted)] italic">No members found</p>
            ) : (
              members.map(member => (
                <div key={member.uid} className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-2xl border transition-all gap-4 select-none cursor-pointer",
                  selectedIds.has(member.uid) ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-white/5 hover:border-white/10"
                )} onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button')) return;
                  toggleSelect(member.uid);
                }}>
                   <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                      selectedIds.has(member.uid) ? "bg-[var(--primary)] border-[var(--primary)]" : "border-white/20"
                    )}>
                      {selectedIds.has(member.uid) && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-lg shrink-0" style={{ color: member.gymConfig?.themeColor || 'var(--primary)' }}>
                      {member.name[0]}
                    </div>
                     <div>
                      <p className="font-bold text-sm sm:text-base mb-1">{member.name}</p>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-x-4 gap-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Phone:</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{member.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Role:</span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/5" style={{ color: member.gymConfig?.themeColor || 'var(--primary)' }}>{member.role}</span>
                        </div>
                        {member.membershipPlanId && gymPlans.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Plan:</span>
                            <span className="text-[10px] font-bold text-white/60">
                              {gymPlans.find(p => p.id === member.membershipPlanId)?.name || member.membershipType || 'Standard'}
                            </span>
                          </div>
                        )}
                        {member.membershipExpiresAt && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Expiry:</span>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/20",
                              member.membershipExpiresAt < Date.now() ? "text-red-500 border border-red-500/20" : "text-green-500 border border-green-500/20"
                            )}>
                              {new Date(member.membershipExpiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 sm:gap-2 justify-end sm:justify-start pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5 mt-1 sm:mt-0">
                    <button onClick={() => setSelectedMember(member)} title="View History" className="p-2 sm:p-2.5 text-[var(--text-muted)] hover:text-white transition-colors bg-white/5 sm:bg-transparent rounded-lg"><History className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                    <button onClick={() => handleEditMember(member)} title="Edit User" className="p-2 sm:p-2.5 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors bg-white/5 sm:bg-transparent rounded-lg"><Edit className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                    <button onClick={() => setConfirmDelete(member.uid)} title="Delete User" className="p-2 sm:p-2.5 text-[var(--text-muted)] hover:text-red-500 transition-colors bg-white/5 sm:bg-transparent rounded-lg"><Trash2 className="w-5 h-5 sm:w-4 sm:h-4" /></button>
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
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Gym Logo</label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    {addForm.logoUrl && (
                      <img src={addForm.logoUrl} alt="Logo Preview" className="w-12 h-12 rounded-lg object-cover bg-white/5 border border-white/10" />
                    )}
                    <div className="flex-1">
                      <label className="relative cursor-pointer">
                        <div className="w-full bg-white/5 border border-white/10 border-dashed rounded-xl px-4 py-4 flex flex-col items-center justify-center gap-1 hover:border-[var(--primary)] transition-all">
                          <Upload className="w-5 h-5 opacity-40" />
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Upload Logo</span>
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
                                setAddForm(prev => ({...prev, logoUrl: reader.result as string}));
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
                      value={addForm.logoUrl.startsWith('data:') ? '' : addForm.logoUrl} 
                      onChange={e => setAddForm({...addForm, logoUrl: e.target.value})} 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] outline-none focus:neon-border" 
                    />
                  </div>
                </div>
              </div>
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

          {user.role === UserRole.SUPER_STAFF && addForm.role === UserRole.MEMBER && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest opacity-60">Assign to Gym *</label>
              <select 
                value={selectedGymId} 
                onChange={e => setSelectedGymId(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
              >
                <option value="">Select a Gym</option>
                <option value="system">Global System</option>
                {gyms.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
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

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest opacity-60">Email</label>
            <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none" />
          </div>

          {editForm.role === UserRole.GYM_STAFF && (
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest opacity-60">Gym Name</label>
                <input type="text" value={editForm.gymName} onChange={e => setEditForm({...editForm, gymName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:neon-border" />
              </div>
              
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Gym Logo</label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    {editForm.logoUrl && (
                      <img src={editForm.logoUrl} alt="Logo Preview" className="w-12 h-12 rounded-lg object-cover bg-white/5 border border-white/10" />
                    )}
                    <div className="flex-1">
                      <label className="relative cursor-pointer">
                        <div className="w-full bg-white/5 border border-white/10 border-dashed rounded-xl px-4 py-4 flex flex-col items-center justify-center gap-1 hover:border-[var(--primary)] transition-all">
                          <Upload className="w-5 h-5 opacity-40" />
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Change Logo</span>
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
                                setEditForm(prev => ({...prev, logoUrl: reader.result as string}));
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
                      value={editForm.logoUrl.startsWith('data:') ? '' : editForm.logoUrl} 
                      onChange={e => setEditForm({...editForm, logoUrl: e.target.value})} 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] outline-none focus:neon-border" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest opacity-60">Theme Color</label>
                <div className="flex gap-4">
                  <input type="color" value={editForm.themeColor} onChange={e => setEditForm({...editForm, themeColor: e.target.value})} className="w-10 h-10 rounded border-none bg-transparent cursor-pointer" />
                  <input type="text" value={editForm.themeColor} onChange={e => setEditForm({...editForm, themeColor: e.target.value})} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono outline-none" />
                </div>
              </div>
            </div>
          )}
          
           {selectedMember?.role === UserRole.MEMBER && (
             <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-60">Plan</label>
                  {gymPlans.length > 0 ? (
                    <select 
                      value={editForm.membershipPlanId} 
                      onChange={e => {
                        const plan = gymPlans.find(p => p.id === e.target.value);
                        if (plan) {
                          const expiry = new Date(Date.now() + plan.durationDays * 86400000).toISOString().split('T')[0];
                          setEditForm({
                            ...editForm, 
                            membershipPlanId: plan.id, 
                            membershipExpiresAt: expiry
                          });
                        } else {
                          setEditForm({...editForm, membershipPlanId: e.target.value});
                        }
                      }}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                    >
                      <option value="">No Plan / Custom</option>
                      {gymPlans.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[10px] text-yellow-500 bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20 leading-tight">
                      No plans created yet. <br/>
                      Go to "Plans" tab to add some.
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-60">Expiry Date</label>
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
        title={confirmDelete === 'multiple' ? `Delete ${selectedIds.size} Users` : "Delete User"}
        message={confirmDelete === 'multiple' 
          ? `Are you sure you want to permanently delete ${selectedIds.size} selected users and their history?` 
          : "Are you sure you want to remove this user? This will permanently delete their account and history."}
        loading={isDeleting}
      />
    </div>
  );
};
