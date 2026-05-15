import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Activity 
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  limit 
} from 'firebase/firestore';
import * as d3 from 'd3';
import { db } from '../firebase';
import { UserProfile, OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestoreUtils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';

interface ProgressTrackerProps {
  user: UserProfile;
}

const WeightChart = ({ data, minWeight, maxWeight }: { data: any[], minWeight: number, maxWeight: number }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    
    window.addEventListener('resize', updateDimensions);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const { width, height } = dimensions;
  const padding = { top: 30, right: 20, bottom: 40, left: 20 };

  if (width === 0 || height === 0) {
    return <div ref={containerRef} className="w-full h-full bg-white/[0.02] rounded-3xl" />;
  }

  if (data.length < 2) {
    return (
      <div ref={containerRef} className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02] gap-3">
        <Activity className="w-8 h-8 opacity-20" />
        <p className="text-xs text-[var(--text-muted)] italic font-bold uppercase tracking-widest">
          Collecting more data points...
        </p>
      </div>
    );
  }

  const timeExtent = d3.extent(data, d => d.timestamp) as [number, number];
  if (timeExtent[0] === timeExtent[1]) {
    timeExtent[0] = timeExtent[0] - 86400000;
    timeExtent[1] = timeExtent[1] + 86400000;
  }

  const xScale = d3.scaleTime()
    .domain(timeExtent)
    .range([padding.left, width - padding.right]);

  const weightDomain = [minWeight, maxWeight];
  if (weightDomain[0] === weightDomain[1]) {
    weightDomain[0] -= 5;
    weightDomain[1] += 5;
  }

  const yScale = d3.scaleLinear()
    .domain(weightDomain)
    .range([height - padding.bottom, padding.top]);

  const areaGenerator = d3.area<any>()
    .x(d => xScale(d.timestamp))
    .y0(height - padding.bottom)
    .y1(d => yScale(d.weight))
    .curve(d3.curveMonotoneX);

  const lineGenerator = d3.line<any>()
    .x(d => xScale(d.timestamp))
    .y(d => yScale(d.weight))
    .curve(d3.curveMonotoneX);

  return (
    <div ref={containerRef} className="w-full h-full relative group">
      <svg width={width} height={height} className="overflow-visible select-none">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const val = weightDomain[0] + (weightDomain[1] - weightDomain[0]) * t;
          const y = yScale(val);
          return (
            <g key={t} className="opacity-20">
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="white"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x={padding.left - 5} y={y} textAnchor="end" alignmentBaseline="middle" className="fill-white text-[8px] font-bold">
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        <path
          d={areaGenerator(data) || ''}
          fill="url(#areaGradient)"
          className="transition-all duration-700 ease-out"
        />

        <path
          d={lineGenerator(data) || ''}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#glow)"
          className="transition-all duration-700 ease-out"
        />

        {data.map((d, i) => (
          <g key={i} className="group/point cursor-pointer transition-all duration-300">
            <circle
              cx={xScale(d.timestamp)}
              cy={yScale(d.weight)}
              r="12"
              fill="transparent"
            />
            <circle
              cx={xScale(d.timestamp)}
              cy={yScale(d.weight)}
              r="5"
              fill="#111"
              stroke="var(--primary)"
              strokeWidth="3"
            />
            
            <g className="opacity-0 group-hover/point:opacity-100 transition-opacity">
               <rect 
                  x={xScale(d.timestamp) - 25} 
                  y={yScale(d.weight) - 35} 
                  width="50" 
                  height="25" 
                  rx="12" 
                  className="fill-black/90 stroke-white/10"
               />
               <text
                x={xScale(d.timestamp)}
                y={yScale(d.weight) - 18}
                textAnchor="middle"
                className="fill-[var(--primary)] text-[11px] font-black italic"
              >
                {d.weight}kg
              </text>
            </g>
          </g>
        ))}

        {data.length > 0 && [data[0], data[Math.floor(data.length/2)], data[data.length-1]].map((d, i) => {
          if (!d) return null;
          return (
            <text
              key={i}
              x={xScale(d.timestamp)}
              y={height - 10}
              textAnchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'}
              className="fill-white/40 text-[9px] font-black uppercase tracking-tighter"
            >
              {new Date(d.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export const ProgressTracker = ({ user }: ProgressTrackerProps) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    weight: 0,
    bodyFat: 0,
    chest: 0,
    waist: 0,
    arms: 0,
    thighs: 0,
    notes: ''
  });

  useEffect(() => {
    const mid = user.id || user.uid;
    if (!mid) return;
    const q = query(collection(db, 'progress'), where('memberId', '==', mid), limit(50));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      data.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(data);
    });
  }, [user.id, user.uid]);

  const handleSave = async () => {
    try {
      if (formData.weight <= 0) return;
      const mid = user.id || user.uid;
      await addDoc(collection(db, 'progress'), {
        ...formData,
        memberId: mid,
        gymId: user.gymId,
        timestamp: Date.now()
      });
      setIsAdding(false);
      setFormData({ weight: 0, bodyFat: 0, chest: 0, waist: 0, arms: 0, thighs: 0, notes: '' });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'progress');
    }
  };

  const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  const weights = logs.map(l => l.weight).filter(w => !isNaN(w) && w > 0);
  const minWeight = weights.length > 0 ? Math.floor(Math.min(...weights) * 0.95) : 0;
  const maxWeight = weights.length > 0 ? Math.ceil(Math.max(...weights) * 1.05) : 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-[var(--primary)]" /> Progress Tracker
        </h2>
        <Button variant="primary" onClick={() => setIsAdding(true)} icon={Plus}>Log Stats</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm uppercase tracking-widest opacity-60">Weight Journey</h3>
            {logs.length > 0 && (
              <div className="text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-1 rounded">
                {weights[weights.length-1]} kg (Latest)
              </div>
            )}
          </div>
          
          <div className="h-[300px] w-full mt-6">
            {logs.length > 1 ? (
              <WeightChart data={sortedLogs} minWeight={minWeight} maxWeight={maxWeight} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02] gap-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                  <Activity className="w-6 h-6 opacity-20" />
                </div>
                <p className="text-xs text-[var(--text-muted)] italic font-bold uppercase tracking-widest">
                  Not enough data for chart
                </p>
                <p className="text-[10px] opacity-40">Keep logging weight to see progress</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="font-bold text-sm uppercase tracking-widest opacity-60">Recent Logs</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {logs.map(log => (
              <div key={log.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black italic">{log.weight} kg</span>
                    {log.bodyFat > 0 && <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">{log.bodyFat}% BF</span>}
                  </div>
                  <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
                  {log.chest > 0 && <p className="text-[9px]"><span className="opacity-40 uppercase">Chest:</span> {log.chest}cm</p>}
                  {log.waist > 0 && <p className="text-[9px]"><span className="opacity-40 uppercase">Waist:</span> {log.waist}cm</p>}
                  {log.arms > 0 && <p className="text-[9px]"><span className="opacity-40 uppercase">Arms:</span> {log.arms}cm</p>}
                  {log.thighs > 0 && <p className="text-[9px]"><span className="opacity-40 uppercase">Thighs:</span> {log.thighs}cm</p>}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="py-12 text-center opacity-30 italic text-xs uppercase tracking-widest font-bold">
                No logs recorded
              </div>
            )}
          </div>
        </Card>
      </div>

      <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} title="Log Body Progress">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-60">Weight (kg) *</label>
              <input 
                type="number" 
                value={formData.weight || ''} 
                onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-60">Body Fat %</label>
              <input 
                type="number" 
                value={formData.bodyFat || ''} 
                onChange={e => setFormData({...formData, bodyFat: parseFloat(e.target.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:neon-border outline-none"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
            <h4 className="text-xs font-black uppercase italic tracking-widest text-[var(--primary)]">Measurements (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase opacity-50">Chest (cm)</label>
                <input type="number" value={formData.chest || ''} onChange={e => setFormData({...formData, chest: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase opacity-50">Waist (cm)</label>
                <input type="number" value={formData.waist || ''} onChange={e => setFormData({...formData, waist: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase opacity-50">Arms (cm)</label>
                <input type="number" value={formData.arms || ''} onChange={e => setFormData({...formData, arms: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase opacity-50">Thighs (cm)</label>
                <input type="number" value={formData.thighs || ''} onChange={e => setFormData({...formData, thighs: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest opacity-60">Notes</label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm h-20 resize-none outline-none"
              placeholder="e.g. Felt strong today"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setIsAdding(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={handleSave} className="flex-1">Save Entry</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
