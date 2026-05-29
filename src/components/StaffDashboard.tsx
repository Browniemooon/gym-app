import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Plus, 
  Save, 
  Dumbbell, 
  History, 
  Activity, 
  CheckCircle, 
  XCircle 
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  limit, 
  onSnapshot, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { UserProfile, CheckIn, OperationType } from '../types';
import { cn } from '../lib/utils';
import { handleFirestoreError } from '../lib/firestoreUtils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { BulkUploadModal } from './BulkUploadModal';

interface StaffDashboardProps {
  user: UserProfile;
  setActiveTab: (tab: string) => void;
}

export const StaffDashboard = ({ user, setActiveTab }: StaffDashboardProps) => {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [membersCount, setMembersCount] = useState(0);
  const [activeMembersCount, setActiveMembersCount] = useState(0);
  const [expiredMembersCount, setExpiredMembersCount] = useState(0);
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [checkinLimit, setCheckinLimit] = useState(50);
  const [hasMoreCheckins, setHasMoreCheckins] = useState(true);

  useEffect(() => {
    if (!user.gymId) return;

    // Separate check-ins listener
    const qCheckins = query(
      collection(db, 'checkins'), 
      where('gymId', '==', user.gymId),
      limit(checkinLimit)
    );
    const unsubCheckins = onSnapshot(qCheckins, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn));
      data.sort((a, b) => b.timestamp - a.timestamp);
      setCheckins(data);
      setHasMoreCheckins(snapshot.docs.length === checkinLimit);
    }, (error) => {
      console.error('Checkins error:', error);
      setStatus('Check-ins unavailable');
    });

    // Separate members listener
    const qMembers = query(collection(db, `gyms/${user.gymId}/members`));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      setMembersCount(snapshot.size);
      const members = snapshot.docs.map(d => d.data());
      const now = Date.now();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      
      setActiveMembersCount(members.filter((m: any) => m.membershipExpiresAt && m.membershipExpiresAt > now).length);
      setExpiredMembersCount(members.filter((m: any) => !m.membershipExpiresAt || m.membershipExpiresAt < now).length);
      setExpiringSoonCount(members.filter((m: any) => m.membershipExpiresAt && m.membershipExpiresAt > now && m.membershipExpiresAt < now + threeDaysMs).length);
    }, (error) => {
      console.error('Members counter error:', error);
    });

    return () => {
      unsubCheckins();
      unsubMembers();
    };
  }, [user.gymId, checkinLimit]);

  const [pendingCheckins, setPendingCheckins] = useState<CheckIn[]>([]);

  useEffect(() => {
    if (!user.uid || !user.gymId) return;

    const qPending = query(
      collection(db, 'checkins'),
      where('gymId', '==', user.gymId),
      where('status', '==', 'request')
    );

    return onSnapshot(qPending, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn));
      data.sort((a, b) => b.timestamp - a.timestamp);
      setPendingCheckins(data);
    });
  }, [user.gymId, user.uid]);

  const handleApprove = async (checkin: CheckIn, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'checkins', checkin.id), {
        status,
        approvedAt: Date.now(),
        approvedBy: user.uid,
        staffName: user.name
      });
      showStatus(`Check-in ${status}`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `checkins/${checkin.id}`);
    }
  };

  const loadMoreCheckins = () => {
    setCheckinLimit(prev => prev + 50);
  };

  const exportToExcel = () => {
    const data = checkins.map(ci => ({
      'Member Name': ci.memberName,
      'Member ID': ci.memberId,
      'Date': ci.day || new Date(ci.timestamp).toLocaleDateString(),
      'Time': ci.time || new Date(ci.timestamp).toLocaleTimeString(),
      'Status': ci.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Check-ins");
    XLSX.writeFile(wb, `${user.gymConfig?.name || 'Gym'}_Checkins.xlsx`);
    showStatus('Exported to Excel');
  };

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h2 className="text-lg md:text-2xl font-black uppercase italic tracking-tight">
              {user?.gymConfig?.name || 'Staff Dashboard'}
            </h2>
            {user?.gymConfig?.name && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-[var(--primary)] font-bold">Staff Portal</span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">{membersCount} Members</span>
              </div>
            )}
          </div>
          {status && (
            <motion.span 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded"
            >
              {status}
            </motion.span>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth">
          <Button variant="ghost" onClick={() => setIsBulkUploading(true)} icon={Plus} className="whitespace-nowrap text-[9px] md:text-xs py-2 px-3 h-auto border-white/5 active:scale-95 transition-transform">
            Upload
          </Button>
          <Button variant="ghost" onClick={exportToExcel} icon={Save} className="whitespace-nowrap text-[9px] md:text-xs py-2 px-3 h-auto border-white/5 active:scale-95 transition-transform">
            Export
          </Button>
          <Button variant="primary" onClick={() => setActiveTab('members')} icon={Users} className="whitespace-nowrap text-[9px] md:text-xs py-2 px-3 h-auto active:scale-95 transition-transform">
            Members
          </Button>
          <Button variant="ghost" onClick={() => setActiveTab('workouts')} icon={Dumbbell} className="whitespace-nowrap text-[9px] md:text-xs py-2 px-3 h-auto border-white/5 active:scale-95 transition-transform">
            Workouts
          </Button>
        </div>
      </div>

      <BulkUploadModal 
        isOpen={isBulkUploading} 
        onClose={() => setIsBulkUploading(false)} 
        gymId={user.gymId || ''}
        onComplete={(summary) => {
          showStatus(`Bulk upload complete: ${summary.success} success, ${summary.failed} failed`);
        }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-blue-500 bg-blue-500/5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-blue-400 mb-1">Total Members</p>
          <p className="text-2xl font-black italic">{membersCount}</p>
        </Card>
        <Card className="p-4 border-l-4 border-[var(--primary)] bg-[var(--primary)]/5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--primary)] mb-1">Active</p>
          <p className="text-2xl font-black italic">{activeMembersCount}</p>
        </Card>
        <Card className="p-4 border-l-4 border-yellow-500 bg-yellow-500/5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-yellow-400 mb-1">Expiring Soon</p>
          <p className="text-2xl font-black italic">{expiringSoonCount}</p>
        </Card>
        <Card className="p-4 border-l-4 border-red-500 bg-red-500/5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-red-400 mb-1">Expired</p>
          <p className="text-2xl font-black italic">{expiredMembersCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-sm md:text-base">
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-yellow-500 animate-pulse" /> Pending Requests
            </h3>
            <div className="space-y-3">
              {pendingCheckins.map(ci => (
                <div key={ci.id} className="p-3 bg-black/20 border border-white/10 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">{ci.memberName}</p>
                      <p className="text-[10px] opacity-70">{ci.time}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleApprove(ci, 'rejected')}
                        className="p-1.5 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleApprove(ci, 'approved')}
                        className="p-1.5 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition-all font-bold text-[10px] flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {pendingCheckins.length === 0 && (
                <div className="py-8 text-center opacity-40">
                  <p className="text-[10px] uppercase tracking-widest font-bold">No pending requests</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-sm md:text-base">
                <History className="w-4 h-4 md:w-5 md:h-5 text-[var(--primary)]" /> Recent Check-ins
              </h3>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {checkins.map(ci => (
                <div key={ci.id} className="p-3 md:p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:border-[var(--primary)]/30 transition-all gap-3">
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-[var(--primary)] text-xs md:text-base shrink-0 border border-white/5">
                      {ci.memberName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs md:text-sm truncate">{ci.memberName}</p>
                      <p className="text-[10px] md:text-xs opacity-60 truncate">{ci.day ? `${ci.day}, ${ci.time}` : new Date(ci.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "text-[9px] md:text-[10px] px-2.5 py-0.5 rounded-full uppercase font-bold border",
                      ci.status === 'approved' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                      ci.status === 'rejected' ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    )}>
                      {ci.status}
                    </span>
                    <p className="text-[8px] md:text-[9px] font-mono opacity-30 mt-1 uppercase tracking-tighter">ID: {ci.memberId.slice(-6)}</p>
                  </div>
                </div>
              ))}
              {checkins.length === 0 && (
                <p className="text-center py-8 text-[var(--text-muted)] italic text-xs">No check-ins recorded yet.</p>
              )}
              {hasMoreCheckins && checkins.length > 0 && (
                <div className="pt-4 flex justify-center">
                  <Button 
                    variant="ghost" 
                    onClick={loadMoreCheckins} 
                    className="text-[10px] uppercase tracking-widest font-bold text-[var(--primary)] hover:bg-[var(--primary)]/10"
                  >
                    Load More History
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
