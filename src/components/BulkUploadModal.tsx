import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Save, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, doc, writeBatch, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { updateRegistry } from '../services/authService';
import { Modal } from './ui/Modal';
import { UserRole, MembershipPlan } from '../types';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  gymId: string;
  onComplete: (summary: { total: number; success: number; failed: number }) => void;
}

export const BulkUploadModal = ({
  isOpen,
  onClose,
  gymId,
  onComplete
}: BulkUploadModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total: number; success: number; failed: number } | null>(null);

  const [gymPlans, setGymPlans] = useState<MembershipPlan[]>([]);

  useEffect(() => {
    if (!gymId || !isOpen) return;
    const q = query(collection(db, `gyms/${gymId}/membershipPlans`), orderBy('price', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setGymPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MembershipPlan)));
    });
  }, [gymId, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setSummary(null);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { name: 'John Doe', email: 'john@example.com', phone: '9876543210', membershipType: 'Premium', expiryDate: '2026-12-31' },
      { name: 'Jane Smith', email: 'jane@example.com', phone: '9123456789', membershipType: 'Basic', expiryDate: '2026-06-15' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Gym_Member_Template.xlsx");
  };

  const processUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

        if (jsonData.length === 0) {
          setError("The file is empty.");
          setIsProcessing(false);
          return;
        }

        const totalRows = jsonData.length;
        let successCount = 0;
        let failedCount = 0;

        const isValidEmail = (email: string) => {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        };

        const normalizePhone = (phone: any): string => {
          if (!phone) return '';
          let cleaned = phone.toString().trim();
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

        const parseExcelDate = (val: any): number | null => {
          if (!val) return null;
          
          // Case 1: Already a Date object
          if (val instanceof Date) return val.getTime();
          
          // Case 2: Number (Excel serial date)
          if (typeof val === 'number') {
            // Excel dates are days since 1900-01-01
            // XLSX handles some of this but just in case:
            const date = new Date((val - 25569) * 86400 * 1000);
            return !isNaN(date.getTime()) ? date.getTime() : null;
          }
          
          // Case 3: String
          const date = new Date(val.toString().trim());
          if (!isNaN(date.getTime())) return date.getTime();

          // Try splitting by hyphen or slash if it's a common date format
          return null;
        };

        const authUsers = jsonData.map(row => {
          const email = (row.email || row.Email || row.email_id || row['Email Address'] || row.contact_email || row.Email_ID || row.MAIL || '').toString().trim();
          const name = (row.name || row.Name || row.member_name || row['Member Name'] || row.full_name || row.Name || row.CUSTOMER || row.CLIENT || '').toString().trim();
          const phone = (row.phone || row.Phone || row.mobile || row.Mobile || row.contact || row['Phone Number'] || row.Personal_Phone || row.whatsapp || row['Mobile NO'] || row.Cell || row.PHONE || '');
          
          return {
            email,
            name,
            phone: normalizePhone(phone)
          };
        }).filter(u => u.name && (u.email || u.phone));

        const validAuthUsers: any[] = [];
        const ignoredUsers: any[] = [];

        authUsers.forEach(u => {
          if (u.email && !isValidEmail(u.email)) {
            ignoredUsers.push(u);
          } else {
            validAuthUsers.push(u);
          }
        });

        if (ignoredUsers.length > 0) {
          failedCount += ignoredUsers.length;
          console.warn("Skipping users with invalid emails:", ignoredUsers.map(u => u.email));
        }

        if (validAuthUsers.length === 0 && ignoredUsers.length === 0) {
          setError("No valid rows found (name and phone/email are required).");
          setIsProcessing(false);
          return;
        }

        const usersWithEmail = validAuthUsers.filter(u => u.email);
        let successfulAuths: any[] = [];
        
        if (usersWithEmail.length > 0) {
          try {
            const response = await fetch('/api/staff/bulk-create-users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ users: usersWithEmail })
            });

            if (response.ok) {
              const authResults = await response.json();
              successfulAuths = authResults.successful;
              
              const failedEmails = authResults.failed.map((f: any) => f.email);
              if (failedEmails.length > 0) {
                console.warn("Some emails failed auth creation:", failedEmails);
              }
              failedCount += authResults.failed.length;
            }
          } catch (authErr) {
            console.error("Auth bulk create failed:", authErr);
          }
        }

        const membersToCreate = jsonData.filter(row => {
          const name = (row.name || row.Name || row.member_name || row['Member Name'] || row.full_name || '').toString().trim();
          const phone = (row.phone || row.Phone || row.mobile || row.Mobile || row.contact || row['Phone Number'] || '');
          const email = (row.email || row.Email || row.email_id || row['Email Address'] || '').toString().trim();
          return name && (phone || email);
        });

        const BATCH_SIZE = 50;
        
        for (let i = 0; i < membersToCreate.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const chunk = membersToCreate.slice(i, i + BATCH_SIZE);

          chunk.forEach((row: any) => {
            const rowEmail = (row.email || row.Email || row.email_id || row['Email Address'] || '').toString().trim();
            const rowName = (row.name || row.Name || row.member_name || row['Member Name'] || row.full_name || row.CUSTOMER || row.CLIENT || '').toString().trim();
            const rowPhone = (row.phone || row.Phone || row.mobile || row.Mobile || row.contact || row['Phone Number'] || row.whatsapp || row['Mobile NO'] || row.Cell || row.PHONE || '');
            
            const authUser = successfulAuths.find(a => a.email === rowEmail);
            const memberId = authUser?.uid || `mem_${Math.random().toString(36).slice(2, 11)}`;
            
            const memberRef = doc(collection(db, `gyms/${gymId}/members`), memberId);
            const normalizedPhone = normalizePhone(rowPhone);
            
            // Try to match plan
            const planValue = (row.membershipType || row.membership || row.plan || row.Plan || row.plan_type || row.Membership || row.type || row['Plan Name'] || row['Membership Type'] || row.scheme || row.Scheme || row.scheme_name || '').toString().trim().toLowerCase();
            
            let matchedPlan = planValue ? gymPlans.find(p => 
              p.name.toLowerCase().trim() === planValue || 
              p.id.toLowerCase().trim() === planValue
            ) : undefined;

            // Fuzzy match fallback
            if (!matchedPlan && planValue) {
              matchedPlan = gymPlans.find(p => 
                p.name.toLowerCase().trim().includes(planValue) || 
                planValue.includes(p.name.toLowerCase().trim())
              );
            }

            const memberData: any = {
              uid: memberId,
              name: rowName,
              email: rowEmail,
              phone: normalizedPhone,
              membershipType: matchedPlan ? matchedPlan.name : (row.membershipType || row.membership || row.plan || row.scheme || 'Standard'),
              gymId: gymId,
              role: UserRole.MEMBER,
              createdAt: Date.now(),
              status: 'active'
            };

            // Link plan ID if matched
            if (matchedPlan) {
              memberData.membershipPlanId = matchedPlan.id;
            }

            // Calculate Expiry: Prefer explicit expiryDate column, then matched plan
            const expiryVal = row.expiryDate || row.expiry || row.expiry_date || row.expiresAt || row['Expiry Date'] || row['End Date'] || row.valid_until || row.expiry_on || row.Expiry;
            const parsedExpiry = parseExcelDate(expiryVal);

            if (parsedExpiry) {
              memberData.membershipExpiresAt = parsedExpiry;
            } else if (matchedPlan) {
              memberData.membershipExpiresAt = Date.now() + (matchedPlan.durationDays * 24 * 60 * 60 * 1000);
            }

            batch.set(memberRef, memberData);
            
            // Populate Registry (Async but we can fire and forget if needed, 
            // though batch is better if we could, but registries are root level)
            if (normalizedPhone) {
              updateRegistry('phone', normalizedPhone, { 
                gymId, 
                memberId, 
                role: UserRole.MEMBER 
              }).catch(e => console.error("Registry update failed:", e));
            }
            
            if (authUser) {
              const userRef = doc(db, 'users', authUser.uid);
              batch.set(userRef, {
                ...memberData,
                uid: authUser.uid,
                email: row.email,
              }, { merge: true });

              updateRegistry('uid', authUser.uid, {
                gymId,
                memberId,
                role: UserRole.MEMBER
              }).catch(e => console.error("UID registry update failed:", e));
            }
          });

          await batch.commit();
          successCount += chunk.length;
          setProgress(Math.round(((i + chunk.length) / membersToCreate.length) * 100));
        }

        const finalSummary = { total: totalRows, success: successCount, failed: failedCount };
        setSummary(finalSummary);
        setIsProcessing(false);
        onComplete(finalSummary);
      };

      reader.readAsBinaryString(file);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during processing.");
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Member Upload">
      <div className="space-y-6">
        {!summary ? (
          <>
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Instructions</p>
              <ul className="text-xs text-[var(--text-muted)] list-disc pl-4 space-y-1">
                <li>Upload .xlsx or .csv files.</li>
                <li>Required columns: <b>name</b>, <b>phone</b>.</li>
                <li>Optional: <b>email</b>, <b>membershipType</b> (or <b>scheme</b>), <b>expiryDate</b> (YYYY-MM-DD).</li>
              </ul>
              <button
                onClick={downloadTemplate}
                className="text-[var(--primary)] text-xs font-bold hover:underline flex items-center gap-1 mt-2"
              >
                <Save className="w-3 h-3" /> Download Sample Template
              </button>
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 text-center transition-all",
                file ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-white/10 hover:border-white/20"
              )}
            >
              <input
                type="file"
                id="bulk-upload-input"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="bulk-upload-input" className="cursor-pointer space-y-3 block">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                  <Plus className={cn("w-6 h-6", file ? "text-[var(--primary)]" : "text-[var(--text-muted)]")} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {file ? file.name : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-1">
                    Excel or CSV (Max 5MB)
                  </p>
                </div>
              </label>
            </div>

            {error && (
              <p className="text-red-500 text-xs text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                  <span className="text-[var(--text-muted)]">Processing...</span>
                  <span className="text-[var(--primary)]">{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--primary)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={processUpload}
                disabled={!file || isProcessing}
                className="flex-1 px-4 py-3 bg-[var(--primary)] text-black rounded-xl text-sm font-bold hover:neon-glow transition-all disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Start Upload"}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-6 text-center py-4">
             <div className="w-16 h-16 bg-[var(--primary)]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-8 h-8 text-[var(--primary)]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-black uppercase italic tracking-tight">Upload Complete</h4>
                <p className="text-sm text-[var(--text-muted)]">Summary of your bulk upload</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="glass p-4 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Total</p>
                  <p className="text-2xl font-black italic">{summary.total}</p>
                </div>
                <div className="glass p-4 rounded-2xl border border-[var(--primary)]/20">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--primary)] mb-1">Success</p>
                  <p className="text-2xl font-black italic text-[var(--primary)]">{summary.success}</p>
                </div>
                <div className="glass p-4 rounded-2xl border border-red-500/20">
                  <p className="text-[10px] uppercase tracking-widest text-red-500 mb-1">Failed</p>
                  <p className="text-2xl font-black italic text-red-500">{summary.failed}</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all active:scale-95"
              >
                Close
              </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
