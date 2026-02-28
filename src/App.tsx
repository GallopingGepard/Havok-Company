/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Users, Calendar, Target, Clock, Search, 
  ChevronRight, LayoutGrid, Radio, ListChecks, 
  UserPlus, CheckCircle2, Loader2, LogOut,
  ChevronDown, Filter, Info, Map as MapIcon,
  FileText, AlertTriangle, Zap, Trash2, Save, X,
  Crosshair, Activity, Terminal, GripVertical, Settings, Key,
  History, Archive, Paperclip, Plus, Download, ExternalLink, BookOpen, Package, Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AttendanceCalendar from './components/AttendanceCalendar';

interface Mission {
  id: number;
  title: string;
  description: string;
  location?: string;
  situation?: string;
  objectives?: string; // JSON string
  env_terrain?: string;
  env_time?: string;
  env_weather?: string;
  env_forecast?: string;
  debrief?: string;
  date: string;
  status: string;
}

interface Attachment {
  id: number;
  mission_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
}

interface RosterMember {
  id: number;
  name: string;
  rank: string;
  squad: string;
  team: string;
  role: string;
  mos_abr: string;
  display_order: number;
}

interface UserAccount {
  id: number;
  username: string;
  role: string;
  roster_id?: number;
  password?: string;
}

interface Attendance {
  id: number;
  mission_id: number;
  name: string;
  role: string;
  squad: string;
  status: string;
  signed_at: string;
}

interface User {
  id: number;
  username: string;
  role: string;
}

const ROLES = [
  { id: 'Rifleman', abr: 'R', icon: Target, desc: 'Assists other M.O.S. by carrying ammunition and other supportive roles.' },
  { id: 'Rifleman Anti-Tank', abr: 'AT', icon: Shield, desc: 'Provides anti-tank support with their SPNKR launcher.' },
  { id: 'Automatic Rifleman', abr: 'AR', icon: Target, desc: 'Provides support-by-fire with their GPMG, LMG and HMG platforms.' },
  { id: 'Grenadier', abr: 'G', icon: Target, desc: 'Deploys HE, Smoke and Flare rounds to support their team.' },
  { id: 'Marksman', abr: 'M', icon: Crosshair, desc: 'Uses DMR and SRS platforms to provide accurate medium-long range fire.' },
  { id: 'Corpsman', abr: 'C', icon: Activity, desc: 'Keeps their team alive by providing essential first aid in the field.' },
  { id: 'Breacher', abr: 'B', icon: Target, desc: 'Uses their shotgun or SMG to efficiently clear buildings and other CQC areas.' },
  { id: 'Squad Leader', abr: 'SL', icon: Terminal, desc: 'Leads one of the two squads and is responsible for communicating with HQ.' },
  { id: 'Fireteam Leader', abr: 'FTL', icon: Terminal, desc: 'Leads one of the four fireteams and executes the orders of their squad leader.' },
  { id: 'Commanding Officer', abr: 'CO', icon: Shield, desc: 'The battle commander who provide oversight and orders to subordinates.' },
  { id: 'Executive Officer', abr: 'XO', icon: Shield, desc: 'Supports the CO with tactical recommendations and coordinates with the SLs.' },
  { id: 'Platoon Corpsman', abr: 'PC', icon: Activity, desc: 'Provides oversight to the corpsmen and supports them during MAS-CAS events.' },
];

const SQUADS = [
  '1-HQ',
  '1-1',
  '1-2',
  '1-3',
  'Guest',
];

const STATUS_COLORS: Record<string, string> = {
  'Attending': '#3b82f6', // Blue
  'Unsure': '#93c5fd', // Light Blue
  'Not Attending': '#ef4444', // Red
  'Attended': '#22c55e', // Green
  'Partial Attendance': '#86efac', // Light Green
  'Absent (Reserves)': '#eab308', // Yellow
  'Absent (LOA)': '#f97316', // Orange
  'Absent (Notice)': '#ef4444', // Red
  'Absent (No Notice)': '#7f1d1d', // Dark Red
};

function MemberModal({ member, onClose, onSave, onDelete }: { 
  member: Partial<RosterMember>, 
  onClose: () => void, 
  onSave: (m: Partial<RosterMember>) => void,
  onDelete?: () => void
}) {
  const [formData, setFormData] = useState(member);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h3 className="text-xs font-black uppercase tracking-widest text-white">Personnel Profile Editor</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Callsign / Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Rank</label>
              <input 
                type="text" 
                value={formData.rank} 
                onChange={e => setFormData({ ...formData, rank: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">MOS ABR</label>
              <input 
                type="text" 
                value={formData.mos_abr} 
                onChange={e => setFormData({ ...formData, mos_abr: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Squad</label>
              <select 
                value={formData.squad} 
                onChange={e => setFormData({ ...formData, squad: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
              >
                {SQUADS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Team</label>
              <select 
                value={formData.team} 
                onChange={e => setFormData({ ...formData, team: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
              >
                {['Command', 'Alpha', 'Bravo', 'Reserves'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Role / MOS</label>
            <input 
              type="text" 
              value={formData.role} 
              onChange={e => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
            />
          </div>
        </div>
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between">
          {onDelete ? (
            <button 
              onClick={onDelete}
              className="px-3 py-2 text-red-500 hover:bg-red-500/10 rounded transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          ) : <div />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Cancel</button>
            <button 
              onClick={() => onSave(formData)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MissionModal({ mission, onClose, onSave, onDelete }: { 
  mission: Partial<Mission>, 
  onClose: () => void, 
  onSave: (m: Partial<Mission>) => void,
  onDelete?: () => void
}) {
  const [formData, setFormData] = useState<Partial<Mission>>({
    ...mission,
    objectives: mission.objectives || JSON.stringify([])
  });

  const objectives = JSON.parse(formData.objectives || '[]');

  const handleAddObjective = () => {
    const newObjectives = [...objectives, ""];
    setFormData({ ...formData, objectives: JSON.stringify(newObjectives) });
  };

  const handleObjectiveChange = (index: number, value: string) => {
    const newObjectives = [...objectives];
    newObjectives[index] = value;
    setFormData({ ...formData, objectives: JSON.stringify(newObjectives) });
  };

  const handleRemoveObjective = (index: number) => {
    const newObjectives = objectives.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, objectives: JSON.stringify(newObjectives) });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
          <h3 className="text-xs font-black uppercase tracking-widest text-white">Mission Intel Editor</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Operation / Mission Title</label>
              <input 
                type="text" 
                value={formData.title || ''} 
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. OPERATION CONDOR"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Deployment Date</label>
              <input 
                type="date" 
                value={formData.date || ''} 
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Location</label>
            <input 
              type="text" 
              value={formData.location || ''} 
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Castiglione, Escala III"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Situation</label>
            <textarea 
              value={formData.situation || ''} 
              onChange={e => setFormData({ ...formData, situation: e.target.value })}
              placeholder="Provide context and background for the mission..."
              className="w-full h-32 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all resize-none custom-scrollbar"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Objectives</label>
              <button 
                onClick={handleAddObjective}
                className="text-xs font-bold uppercase tracking-widest text-cyan-500 hover:text-cyan-400 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Objective
              </button>
            </div>
            <div className="space-y-2">
              {objectives.map((obj: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-600 w-4">{index + 1}.</span>
                  <input 
                    type="text" 
                    value={obj} 
                    onChange={e => handleObjectiveChange(index, e.target.value)}
                    placeholder={`Objective ${index + 1}`}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
                  />
                  <button 
                    onClick={() => handleRemoveObjective(index)}
                    className="text-slate-600 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {objectives.length === 0 && (
                <div className="text-[10px] font-mono text-slate-600 italic py-2">No objectives defined.</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Environment</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Terrain</label>
                <input 
                  type="text" 
                  value={formData.env_terrain || ''} 
                  onChange={e => setFormData({ ...formData, env_terrain: e.target.value })}
                  placeholder="e.g. Temperate Forest"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Time</label>
                <input 
                  type="text" 
                  value={formData.env_time || ''} 
                  onChange={e => setFormData({ ...formData, env_time: e.target.value })}
                  placeholder="e.g. 07:30 MST"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Weather</label>
                <input 
                  type="text" 
                  value={formData.env_weather || ''} 
                  onChange={e => setFormData({ ...formData, env_weather: e.target.value })}
                  placeholder="e.g. Cloudy"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Forecast</label>
                <input 
                  type="text" 
                  value={formData.env_forecast || ''} 
                  onChange={e => setFormData({ ...formData, env_forecast: e.target.value })}
                  placeholder="e.g. Heavy Rain"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Mission Debrief (Markdown Supported)</label>
            <textarea 
              value={formData.debrief || ''} 
              onChange={e => setFormData({ ...formData, debrief: e.target.value })}
              placeholder="Post-mission analysis and results..."
              className="w-full h-32 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all resize-none custom-scrollbar"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between shrink-0">
          {onDelete ? (
            <button 
              onClick={onDelete}
              className="px-3 py-2 text-red-500 hover:bg-red-500/10 rounded transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Scrap Mission
            </button>
          ) : <div />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Cancel</button>
            <button 
              onClick={() => onSave(formData)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              {mission.id ? 'Update Briefing' : 'Create Mission'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PasswordModal({ onClose, onSave, success, error }: { 
  onClose: () => void, 
  onSave: (p: string) => void,
  success: boolean,
  error: string
}) {
  const [pwd, setPwd] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h3 className="text-xs font-black uppercase tracking-widest text-white">Security Protocol Update</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-mono p-3 rounded text-center uppercase">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-mono p-3 rounded text-center uppercase">
              Password Updated Successfully
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">New Access Key</label>
            <input 
              type="password" 
              value={pwd} 
              onChange={e => setPwd(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
            />
          </div>
        </div>
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Cancel</button>
          <button 
            onClick={() => onSave(pwd)}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all"
          >
            Update Key
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AccountModal({ account, roster, onClose, onSave, onDelete }: { 
  account: Partial<UserAccount>, 
  roster: RosterMember[],
  onClose: () => void, 
  onSave: (a: Partial<UserAccount>) => void,
  onDelete?: () => void
}) {
  const [formData, setFormData] = useState(account);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h3 className="text-xs font-black uppercase tracking-widest text-white">Personnel Account Manager</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Username / Callsign</label>
            <input 
              type="text" 
              value={formData.username} 
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Password {formData.id ? '(Leave blank to keep current)' : ''}</label>
            <input 
              type="password" 
              value={formData.password || ''} 
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Access Level</label>
              <select 
                value={formData.role} 
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
              >
                <option value="member">Member</option>
                <option value="guest">Guest</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Link to Roster</label>
              <select 
                value={formData.roster_id || ''} 
                onChange={e => setFormData({ ...formData, roster_id: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500/50 outline-none transition-all"
              >
                <option value="">No Link</option>
                {roster.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between">
          {onDelete ? (
            <button 
              onClick={onDelete}
              className="px-3 py-2 text-red-500 hover:bg-red-500/10 rounded transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Deactivate
            </button>
          ) : <div />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Cancel</button>
            <button 
              onClick={() => onSave(formData)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              {formData.id ? 'Update Account' : 'Create Account'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SortableMember({ member, isAdmin, stats, memberStatus, onEdit }: { 
  member: RosterMember, 
  isAdmin: boolean,
  stats: any,
  memberStatus: any,
  onEdit: (m: RosterMember) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="flex items-center border border-slate-800 bg-slate-900/40 group hover:border-cyan-500/30 transition-colors overflow-hidden relative"
    >
      {isAdmin && (
        <div 
          {...attributes} 
          {...listeners}
          className="w-6 flex items-center justify-center text-slate-700 hover:text-cyan-500 cursor-grab active:cursor-grabbing border-r border-slate-800/50"
        >
          <GripVertical className="w-3 h-3" />
        </div>
      )}
      <div className="w-10 bg-yellow-500/90 flex items-center justify-center text-[10px] font-black text-black border-r border-slate-800">
        {member.mos_abr}
      </div>
      <div className="flex-1 px-3 py-1.5 min-w-0">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold text-slate-100 truncate">{member.name}</div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: stats.statusColor }} />
            <span className="text-[10px] font-mono text-slate-500">{stats.completed} OPS</span>
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter truncate">{member.role}</div>
      </div>
      
      {isAdmin && (
        <button 
          onClick={() => onEdit(member)}
          className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 bg-slate-800 rounded text-cyan-400 hover:text-white transition-all"
        >
          <Info className="w-3 h-3" />
        </button>
      )}

      {memberStatus && (
        <div 
          className="w-1.5 self-stretch" 
          style={{ backgroundColor: STATUS_COLORS[memberStatus.status] }} 
          title={memberStatus.status}
        />
      )}
    </div>
  );
}

function DroppableList({ id, items, title, colorClass, children }: any) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div className={colorClass ? 'border-b border-slate-800' : ''} ref={setNodeRef}>
      {title && <div className={`${colorClass} p-1 text-center text-[10px] font-black tracking-widest text-white uppercase`}>{title}</div>}
      <SortableContext items={items.map((m: any) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-slate-800 min-h-[40px]">
          {children}
        </div>
      </SortableContext>
    </div>
  );
}

export default function App() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [missionAttachments, setMissionAttachments] = useState<Attachment[]>([]);
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingUp, setSigningUp] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Rifleman');
  const [squad, setSquad] = useState('1-1');
  const [status, setStatus] = useState('Attending');
  const [view, setView] = useState<'briefing' | 'roster' | 'status' | 'login' | 'accounts' | 'history' | 'documentation' | 'landing'>('login');
  const [searchTerm, setSearchTerm] = useState('');
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [attendanceView, setAttendanceView] = useState<'calendar' | 'discharged'>('calendar');
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [guestUsername, setGuestUsername] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [authError, setAuthError] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [selectedHistoryMission, setSelectedHistoryMission] = useState<Mission | null>(null);
  const [historyAttendance, setHistoryAttendance] = useState<Attendance[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // Admin States
  const [editingMember, setEditingMember] = useState<RosterMember | null>(null);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [isCreatingMission, setIsCreatingMission] = useState(false);
  const [isCreatingMember, setIsCreatingMember] = useState(false);

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const isAdmin = user?.role === 'admin';

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    checkAuth().finally(() => setLoading(false));
    setupWebSocket();
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (user) {
      Promise.all([fetchMissions(), fetchRoster(), fetchAllAttendance()]);
      if (isAdmin) fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    if (view === 'accounts' && isAdmin) {
      fetchUsers();
    }
  }, [view, isAdmin]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        if (view === 'login') {
          setView('roster');
        }
      } else {
        setUser(null);
        if (view !== 'login') {
          setView('login');
        }
      }
    } catch (err) {
      console.error('Auth check failed', err);
      setUser(null);
      setView('login');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setView('roster');
        setLoginUsername('');
        setLoginPassword('');
      } else {
        setAuthError('Invalid credentials');
      }
    } catch (err) {
      setAuthError('Login failed');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setView('roster');
        setAdminUsername('');
        setAdminPassword('');
      } else {
        setAdminAuthError('Invalid credentials');
      }
    } catch (err) {
      setAdminAuthError('Login failed');
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!guestUsername.trim() || !guestPassword.trim()) return setAuthError('Please enter credentials');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: guestUsername, password: guestPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
        setView('roster');
        setGuestUsername('');
        setGuestPassword('');
      } else {
        setAuthError(data.error);
      }
    } catch (err) {
      setAuthError('Connection failed');
    }
  };

  const handleChangePassword = async (pwd: string) => {
    setAuthError('');
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pwd }),
      });
      if (response.ok) {
        setPasswordChangeSuccess(true);
        setTimeout(() => {
          setIsChangingPassword(false);
          setPasswordChangeSuccess(false);
          setNewPassword('');
        }, 2000);
      } else {
        const data = await response.json();
        setAuthError(data.error);
      }
    } catch (err) {
      setAuthError('Connection failed');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setView('login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const fetchAllAttendance = async () => {
    try {
      const res = await fetch('/api/attendance');
      const data = await res.json();
      setAllAttendance(data);
    } catch (err) {
      console.error('Failed to fetch all attendance', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          console.error('Failed to fetch users:', data.error);
        } else {
          const text = await res.text();
          console.error('Failed to fetch users (HTML):', text);
        }
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const handleSaveUser = async (account: Partial<UserAccount>) => {
    const isNew = !account.id;
    const url = isNew ? '/api/users' : `/api/users/${account.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      });
      if (res.ok) {
        fetchUsers();
        setEditingUser(null);
        setIsCreatingUser(false);
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          alert(`Failed to save user: ${data.error || res.statusText}`);
        } else {
          const text = await res.text();
          console.error("Server returned non-JSON error:", text);
          alert(`Failed to save user: Server error (${res.status}). Check console for details.`);
        }
      }
    } catch (err) {
      console.error('Failed to save user', err);
      alert('Failed to save user. Network error or server is down.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
        setEditingUser(null);
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          alert(`Failed to delete user: ${data.error || res.statusText}`);
        } else {
          const text = await res.text();
          console.error("Server returned non-JSON error:", text);
          alert(`Failed to delete user: Server error (${res.status}). Check console for details.`);
        }
      }
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('Failed to delete user. Network error or server is down.');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeMember = roster.find(m => m.id === active.id);
    if (!activeMember) return;

    let newRoster = [...roster];
    let newSquad = activeMember.squad;
    let newTeam = activeMember.team;
    let insertIndex = -1;

    const overId = String(over.id);

    if (overId.startsWith('squad:')) {
      // Dropped on an empty droppable area
      const parts = overId.split(':');
      newSquad = parts[1];
      newTeam = parts[3];
      
      const oldIndex = roster.findIndex(m => m.id === active.id);
      newRoster.splice(oldIndex, 1);
      
      const lastIndex = newRoster.map(m => m.squad === newSquad && m.team === newTeam).lastIndexOf(true);
      if (lastIndex !== -1) {
        insertIndex = lastIndex + 1;
      } else {
        const squadLastIndex = newRoster.map(m => m.squad === newSquad).lastIndexOf(true);
        insertIndex = squadLastIndex !== -1 ? squadLastIndex + 1 : newRoster.length;
      }
      newRoster.splice(insertIndex, 0, { ...activeMember, squad: newSquad, team: newTeam });
    } else {
      // Dropped on another member
      const overMember = roster.find(m => m.id === over.id);
      if (!overMember) return;

      newSquad = overMember.squad;
      newTeam = overMember.team;

      const oldIndex = roster.findIndex(m => m.id === active.id);
      const newIndex = roster.findIndex(m => m.id === over.id);

      newRoster.splice(oldIndex, 1);
      newRoster.splice(newIndex, 0, { ...activeMember, squad: newSquad, team: newTeam });
    }

    setRoster(newRoster);

    // Persist to server
    const membersToUpdate = newRoster.map((m, index) => ({
      id: m.id,
      display_order: index,
      squad: m.squad,
      team: m.team
    }));

    try {
      await fetch('/api/roster/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: membersToUpdate }),
      });
    } catch (err) {
      console.error('Failed to persist reorder', err);
    }
  };

  useEffect(() => {
    if (selectedMission) {
      fetchAttendance(selectedMission.id);
      fetchAttachments(selectedMission.id);
    }
  }, [selectedMission]);

  const handleCompleteMission = async (missionId: number) => {
    if (!window.confirm('Are you sure you want to mark this mission as complete? It will be moved to the archive.')) return;
    try {
      const res = await fetch(`/api/missions/${missionId}/complete`, { method: 'PUT' });
      if (res.ok) {
        fetchMissions();
        setSelectedMission(null);
      }
    } catch (err) {
      console.error('Failed to complete mission', err);
    }
  };

  const handleUpdateAttendance = async (attendanceId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/attendance/${attendanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        // State will be updated via WebSocket broadcast
      }
    } catch (err) {
      console.error('Failed to update attendance', err);
    }
  };

  const handleRemoveAttendance = async (attendanceId: number) => {
    if (!confirm('Are you sure you want to remove this entry from the manifest?')) return;
    try {
      const res = await fetch(`/api/attendance/${attendanceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        // State will be updated via WebSocket broadcast
      }
    } catch (err) {
      console.error('Failed to remove attendance', err);
    }
  };

  const setupWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'UPDATE_ROSTER') fetchRoster();
      if (data.type === 'UPDATE_MISSIONS') fetchMissions();
      if (data.type === 'UPDATE_USERS' && userRef.current?.role === 'admin') fetchUsers();
      
      if (data.type === 'SIGNUP_UPDATE') {
        setAllAttendance(prev => {
          const index = prev.findIndex(a => a.id === data.entry.id);
          if (index !== -1) {
            const next = [...prev];
            next[index] = data.entry;
            return next;
          }
          return [data.entry, ...prev];
        });
        if (selectedMission && Number(data.missionId) === selectedMission.id) {
          setAttendance(prev => {
            const index = prev.findIndex(a => a.name === data.entry.name);
            if (index !== -1) {
              const next = [...prev];
              next[index] = data.entry;
              return next;
            }
            return [data.entry, ...prev];
          });
        }
        if (selectedHistoryMission && Number(data.missionId) === selectedHistoryMission.id) {
          setHistoryAttendance(prev => {
            const index = prev.findIndex(a => a.id === data.entry.id);
            if (index !== -1) {
              const next = [...prev];
              next[index] = data.entry;
              return next;
            }
            return [data.entry, ...prev];
          });
        }
      }

      if (data.type === 'SIGNUP_DELETE') {
        setAllAttendance(prev => prev.filter(a => a.id !== Number(data.id)));
        if (selectedMission && Number(data.missionId) === selectedMission.id) {
          setAttendance(prev => prev.filter(a => a.id !== Number(data.id)));
        }
        if (selectedHistoryMission && Number(data.missionId) === selectedHistoryMission.id) {
          setHistoryAttendance(prev => prev.filter(a => a.id !== Number(data.id)));
        }
      }
    };

    socket.onclose = () => {
      setTimeout(setupWebSocket, 3000);
    };

    socketRef.current = socket;
  };

  const fetchMissions = async () => {
    try {
      const res = await fetch('/api/missions');
      if (res.ok) {
        const data = await res.json();
        setMissions(data);
        if (data.length > 0 && !selectedMission) setSelectedMission(data[0]);
      } else {
        console.error('Failed to fetch missions:', res.statusText);
      }
    } catch (err) {
      console.error('Failed to fetch missions', err);
    }
  };

  const fetchRoster = async () => {
    try {
      const res = await fetch('/api/roster');
      if (res.ok) {
        const data = await res.json();
        setRoster(data);
      } else {
        console.error('Failed to fetch roster:', res.statusText);
      }
    } catch (err) {
      console.error('Failed to fetch roster', err);
    }
  };

  const fetchAttendance = async (missionId: number) => {
    try {
      const res = await fetch(`/api/missions/${missionId}/attendance`);
      const data = await res.json();
      setAttendance(data);
    } catch (err) {
      console.error('Failed to fetch attendance', err);
    }
  };

  const fetchAttachments = async (missionId: number) => {
    try {
      const res = await fetch(`/api/missions/${missionId}/attachments`);
      const data = await res.json();
      setMissionAttachments(data);
    } catch (err) {
      console.error('Failed to fetch attachments', err);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedMission || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/missions/${selectedMission.id}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        fetchAttachments(selectedMission.id);
      }
    } catch (err) {
      console.error('Failed to upload attachment', err);
    }
  };

  const handleDeleteAttachment = async (id: number) => {
    if (!window.confirm('Delete this attachment?')) return;
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      if (res.ok && selectedMission) {
        fetchAttachments(selectedMission.id);
      }
    } catch (err) {
      console.error('Failed to delete attachment', err);
    }
  };

  const handleSignup = async (selectedStatus: string) => {
    if (!selectedMission || !user) return;

    setSigningUp(true);
    try {
      const res = await fetch(`/api/missions/${selectedMission.id}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.username, status: selectedStatus }),
      });
      if (res.ok) {
        fetchAttendance(selectedMission.id);
      } else {
        const data = await res.json();
        alert(`Signup failed: ${data.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Signup failed', err);
      alert('Signup failed. Check console for details.');
    } finally {
      setSigningUp(false);
    }
  };

  const handleSaveMember = async (member: Partial<RosterMember>) => {
    const isNew = !member.id;
    const url = isNew ? '/api/roster' : `/api/roster/${member.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      if (res.ok) {
        fetchRoster();
        setEditingMember(null);
        setIsCreatingMember(false);
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          alert(`Failed to save member: ${data.error || res.statusText}`);
        } else {
          const text = await res.text();
          console.error("Server returned non-JSON error:", text);
          alert(`Failed to save member: Server error (${res.status}). Check console for details.`);
        }
      }
    } catch (err) {
      console.error('Failed to save member', err);
      alert('Failed to save member. Network error or server is down.');
    }
  };

  const handleDeleteMember = async (id: number) => {
    if (!confirm('Are you sure you want to remove this personnel from the roster?')) return;
    try {
      const res = await fetch(`/api/roster/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRoster();
        setEditingMember(null);
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          alert(`Failed to delete member: ${data.error || res.statusText}`);
        } else {
          const text = await res.text();
          console.error("Server returned non-JSON error:", text);
          alert(`Failed to delete member: Server error (${res.status}). Check console for details.`);
        }
      }
    } catch (err) {
      console.error('Failed to delete member', err);
      alert('Failed to delete member. Network error or server is down.');
    }
  };

  const handleSaveMission = async (mission: Partial<Mission>) => {
    const isNew = !mission.id;
    const url = isNew ? '/api/missions' : `/api/missions/${mission.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mission),
      });
      if (res.ok) {
        fetchMissions();
        setEditingMission(null);
        setIsCreatingMission(false);
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          alert(`Failed to save mission: ${data.error || res.statusText}`);
        } else {
          const text = await res.text();
          console.error("Server returned non-JSON error:", text);
          alert(`Failed to save mission: Server error (${res.status}). Check console for details.`);
        }
      }
    } catch (err) {
      console.error('Failed to save mission', err);
      alert('Failed to save mission. Network error or server is down.');
    }
  };

  const fetchHistoryAttendance = async (missionId: number) => {
    try {
      const res = await fetch(`/api/missions/${missionId}/attendance`);
      const data = await res.json();
      setHistoryAttendance(data);
    } catch (err) {
      console.error('Failed to fetch history attendance', err);
    }
  };

  useEffect(() => {
    if (selectedHistoryMission) {
      fetchHistoryAttendance(selectedHistoryMission.id);
    }
  }, [selectedHistoryMission]);

  const handleDeleteMission = async (id: number) => {
    if (!confirm('Are you sure you want to delete this mission? All attendance data will be lost.')) return;
    try {
      const res = await fetch(`/api/missions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMissions();
        setEditingMission(null);
        if (selectedMission?.id === id) setSelectedMission(null);
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          alert(`Failed to delete mission: ${data.error || res.statusText}`);
        } else {
          const text = await res.text();
          console.error("Server returned non-JSON error:", text);
          alert(`Failed to delete mission: Server error (${res.status}). Check console for details.`);
        }
      }
    } catch (err) {
      console.error('Failed to delete mission', err);
      alert('Failed to delete mission. Network error or server is down.');
    }
  };

  const getMemberStatus = (memberName: string) => {
    return attendance.find(a => a.name === memberName);
  };

  const getMemberStats = (memberName: string) => {
    const memberAttendance = allAttendance.filter(a => a.name === memberName);
    const completed = memberAttendance.filter(a => a.status === 'Attended').length;
    
    // Sort by date to get most recent
    const sorted = [...memberAttendance].sort((a, b) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime());
    const last4Weeks = sorted.slice(0, 4);
    
    let statusColor = '#22c55e'; // Green (Active)
    if (last4Weeks.length === 0) statusColor = '#ef4444'; // Red (Inactive/Remove)
    else if (last4Weeks.length <= 1) statusColor = '#eab308'; // Yellow (Reserves)
    else if (last4Weeks.length <= 2) statusColor = '#3b82f6'; // Blue (Warning)

    return {
      completed,
      statusColor,
      isSignedUp: attendance.some(a => a.name === memberName && a.mission_id === selectedMission?.id)
    };
  };

  const renderORBATMember = (member: RosterMember) => {
    const memberStatus = getMemberStatus(member.name);
    const stats = getMemberStats(member.name);
    
    return (
      <SortableMember 
        key={member.id}
        member={member}
        isAdmin={isAdmin}
        stats={stats}
        memberStatus={memberStatus}
        onEdit={setEditingMember}
      />
    );
  };

  const renderSquadORBAT = (squadId: string) => {
    const squadMembers = roster.filter(m => m.squad === squadId);
    const command = squadMembers.filter(m => m.team === 'Command');
    const alpha = squadMembers.filter(m => m.team === 'Alpha');
    const bravo = squadMembers.filter(m => m.team === 'Bravo');
    const reserves = squadMembers.filter(m => m.team === 'Reserves');

    const isHQ = squadId === '1-HQ';
    const isReserves = squadId === '1-3';

    const renderSortableList = (items: RosterMember[], title?: string, colorClass?: string, droppableId?: string) => (
      <DroppableList id={droppableId} items={items} title={title} colorClass={colorClass}>
        {items.map(renderORBATMember)}
      </DroppableList>
    );

    return (
      <div className="space-y-0 border border-slate-800 bg-black/40 shadow-2xl">
        {/* Squad Header */}
        <div className={`${isHQ ? 'bg-slate-800' : 'bg-slate-800'} p-1.5 text-center font-black tracking-[0.4em] text-white text-xs uppercase border-b border-slate-700`}>
          {squadId}
        </div>

        {/* Command / HQ Elements */}
        {(command.length > 0 || squadId === '1-1' || squadId === '1-2' || squadId === '1-HQ') && renderSortableList(command, 'HQ Section', 'bg-blue-800', `squad:${squadId}:team:Command`)}

        {/* Alpha & Bravo Teams */}
        {!isHQ && !isReserves && (
          <div className="grid grid-cols-2 gap-0">
            <div className="border-r border-slate-800">
              {renderSortableList(alpha, 'Alpha Team (Assault)', 'bg-red-700/90', `squad:${squadId}:team:Alpha`)}
            </div>
            <div>
              {renderSortableList(bravo, 'Bravo Team (Support)', 'bg-green-700/90', `squad:${squadId}:team:Bravo`)}
            </div>
          </div>
        )}

        {/* Reserves Pool */}
        {isReserves && renderSortableList(reserves, undefined, undefined, `squad:${squadId}:team:Reserves`)}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          <div className="text-[10px] font-mono text-cyan-500/50 tracking-[0.2em] uppercase">Initializing VISR Link...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050608] text-slate-200 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
      {/* Scanline Effect Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/40 rounded flex items-center justify-center cursor-pointer"
              onClick={() => setView(user ? 'roster' : 'landing')}
            >
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tighter text-white uppercase">Havok Company</h1>
              <div className="text-xs font-mono text-cyan-500/60 tracking-widest uppercase">Task Force Warden</div>
            </div>
          </div>
          
          {user && (
            <nav className="flex items-center gap-1">
              <button 
                onClick={() => setView('briefing')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${view === 'briefing' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                Mission Briefing
              </button>
              <button 
                onClick={() => setView('roster')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${view === 'roster' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                Unit Roster
              </button>
              <button 
                onClick={() => setView('status')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${view === 'status' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                Attendance
              </button>
              <button 
                onClick={() => setView('documentation')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${view === 'documentation' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                Documentation
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setView('accounts')}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${view === 'accounts' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  Accounts
                </button>
              )}
            </nav>
          )}

          <div className="hidden lg:flex items-center gap-6 text-xs font-mono text-slate-500 uppercase">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-xs font-mono text-slate-400">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} GMT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsChangingPassword(true)}
                      className="text-xs font-black tracking-widest text-cyan-400 uppercase hover:text-cyan-300 transition-colors"
                    >
                      {user.username}
                    </button>
                    {user.role === 'admin' && <Shield className="w-3 h-3 text-cyan-500" />}
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="px-3 py-1 border border-slate-800 rounded hover:border-red-500/50 hover:text-red-400 transition-all"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} GMT
                </div>
                <button 
                  onClick={() => setView('login')}
                  className="px-3 py-1 border border-cyan-500/30 rounded text-cyan-400 hover:bg-cyan-500/10 transition-all"
                >
                  Login
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto mt-20 text-center"
            >
              <div className="flex flex-col items-center gap-12">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500/20 blur-[100px] rounded-full" />
                  <div className="w-48 h-48 bg-slate-900/60 border border-slate-800 rounded-full flex items-center justify-center relative z-10">
                    <Shield className="w-24 h-24 text-cyan-500" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-4xl font-black tracking-[0.2em] text-white uppercase italic">Havok Company VISR Link</h2>
                  <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Task Force Warden // Office of Naval Intelligence</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                  <button 
                    onClick={() => setView('login')}
                    className="group relative overflow-hidden bg-slate-900/40 border border-slate-800 p-8 rounded-lg hover:border-cyan-500/50 transition-all"
                  >
                    <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex flex-col items-center gap-4">
                      <Users className="w-8 h-8 text-cyan-500" />
                      <div>
                        <div className="text-lg font-black text-white uppercase tracking-widest">Member Access</div>
                        <div className="text-[10px] font-mono text-slate-500 uppercase mt-1">Personnel Database & Briefings</div>
                      </div>
                    </div>
                  </button>

                  <button 
                    onClick={() => setView('login')}
                    className="group relative overflow-hidden bg-slate-900/40 border border-slate-800 p-8 rounded-lg hover:border-red-500/50 transition-all"
                  >
                    <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex flex-col items-center gap-4">
                      <Shield className="w-8 h-8 text-red-500" />
                      <div>
                        <div className="text-lg font-black text-white uppercase tracking-widest">Admin Access</div>
                        <div className="text-[10px] font-mono text-slate-500 uppercase mt-1">Command & Control Uplink</div>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="flex items-center gap-8 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Secure Connection
                  </div>
                  <div>Protocol 7-A Active</div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'roster' && (
            <motion.div 
              key="roster"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12"
            >
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="flex flex-col items-center gap-12">
                  {isAdmin && (
                    <div className="w-full max-w-md flex justify-center">
                      <button 
                        onClick={() => setIsCreatingMember(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 rounded text-cyan-400 text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-600/30 transition-all"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add New Personnel
                      </button>
                    </div>
                  )}

                  {/* 1-HQ at top center */}
                  <div className="w-full max-w-md">
                    {renderSquadORBAT('1-HQ')}
                  </div>
                  
                  {/* 1-1, 1-3, 1-2 in a row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 w-full">
                    <div className="space-y-8">
                      {renderSquadORBAT('1-1')}
                    </div>
                    <div className="space-y-8">
                      {renderSquadORBAT('1-3')}
                    </div>
                    <div className="space-y-8">
                      {renderSquadORBAT('1-2')}
                    </div>
                  </div>
                </div>
              </DndContext>

              {/* Legend & Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-800 pt-12">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rank Structure</h3>
                  <div className="bg-slate-900/40 border border-slate-800 p-4 space-y-1 text-[11px] font-mono text-slate-400">
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>1st Lieutenant</span><span className="text-slate-200">Officer, Platoon Leader</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>2nd Lieutenant</span><span className="text-slate-200">Officer, 2IC Executive Officer</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Sergeant Major</span><span className="text-slate-200">Senior Enlisted, Platoon Sergeant</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Master Gunnery Sergeant</span><span className="text-slate-200">Senior Enlisted</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>First Sergeant</span><span className="text-slate-200">Senior Enlisted</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Master Sergeant / Chief Hospital Corpsman</span><span className="text-slate-200">Senior Enlisted</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Gunnery Sergeant / Hospitalman First Class</span><span className="text-slate-200">Senior Enlisted</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Staff Sergeant / Hospitalman Second Class</span><span className="text-slate-200">Senior Enlisted</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Sergeant / Hospitalman Third Class</span><span className="text-slate-200">Junior Enlisted</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Corporal / Hospitalman</span><span className="text-slate-200">Junior Enlisted</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Lance Corporal / Hospitalman Apprentice</span><span className="text-slate-200">Junior Enlisted</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Private First Class / Hospitalman Recruit</span><span className="text-slate-200">Junior Enlisted</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Private</span><span className="text-slate-200">Junior Enlisted</span></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Radio Channels</h3>
                  <div className="bg-slate-900/40 border border-slate-800 p-4 space-y-2 text-[10px] font-mono text-slate-400">
                    <div className="text-cyan-500 font-bold mb-1">LR 148</div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>HQ</span><span className="text-slate-200">CH 1</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Zeus</span><span className="text-slate-200">CH 2</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Medical</span><span className="text-slate-200">CH 3</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Auxillery 1</span><span className="text-slate-200">CH 4</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Auxillery 2</span><span className="text-slate-200">CH 5</span></div>
                    <div className="text-cyan-500 font-bold mt-2 mb-1">SR 343</div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>1-1</span><span className="text-slate-200">CH 1</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>1-2</span><span className="text-slate-200">CH 2</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>HQ</span><span className="text-slate-200">CH 3</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Zeus</span><span className="text-slate-200">CH 4</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Medical</span><span className="text-slate-200">CH 5</span></div>
                    <div className="flex justify-between border-b border-slate-800 pb-1"><span>Auxillery</span><span className="text-slate-200">CH 6</span></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">M.O.S. Protocol</h3>
                  <div className="bg-slate-900/40 border border-slate-800 p-4 space-y-1 text-[11px] font-mono text-slate-400">
                    <div className="grid grid-cols-[40px_140px_1fr] gap-4 border-b border-slate-800 pb-2 mb-2 text-cyan-500 font-black tracking-widest uppercase">
                      <span>ABR</span>
                      <span>MOS NAME</span>
                      <span>DESCRIPTION</span>
                    </div>
                    {ROLES.map(role => (
                      <div key={role.abr} className="grid grid-cols-[40px_140px_1fr] gap-4 border-b border-slate-800/50 pb-1 hover:bg-slate-800/20 transition-colors">
                        <span className="text-cyan-500 font-bold">{role.abr}</span>
                        <span className="text-slate-200">{role.id}</span>
                        <span className="text-slate-400 leading-tight">{role.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'status' && (
            <motion.div 
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-tighter text-white uppercase italic">Deployment Status Manifest</h2>
                  <p className="text-[10px] font-mono text-slate-500 uppercase mt-1">Real-time Personnel Tracking // {selectedMission?.title || 'N/A'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-900/40 border border-slate-800 p-1 rounded">
                    <button
                      onClick={() => setAttendanceView('calendar')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${
                        attendanceView === 'calendar' 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Calendar
                    </button>
                    <button
                      onClick={() => setAttendanceView('discharged')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${
                        attendanceView === 'discharged' 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Discharged
                    </button>
                  </div>
                </div>
              </div>

              {attendanceView === 'calendar' ? (
                <AttendanceCalendar roster={roster} missions={missions} allAttendance={allAttendance} />
              ) : (
                <AttendanceCalendar roster={roster} missions={missions} allAttendance={allAttendance} showDischargedOnly={true} />
              )}

              {/* Status Legend */}
              <div className="flex flex-wrap gap-x-6 gap-y-3 p-4 bg-slate-900/20 border border-slate-800 rounded">
                {Object.entries(STATUS_COLORS).map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                    <History className="w-6 h-6 text-cyan-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter text-white uppercase italic">Mission History Archive</h2>
                    <p className="text-[10px] font-mono text-slate-500 uppercase mt-1">Classified Records // Task Force Warden</p>
                  </div>
                </div>
                <button 
                  onClick={() => setView('briefing')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-all"
                >
                  Return to Briefing
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Mission List */}
                <div className="lg:col-span-4 space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Archive Manifest</h3>
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {missions.filter(m => m.status === 'completed').map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedHistoryMission(m)}
                        className={`w-full p-4 rounded border text-left transition-all group ${
                          selectedHistoryMission?.id === m.id
                            ? 'bg-cyan-500/10 border-cyan-500/50'
                            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">OP_{m.id}</span>
                          <span className="text-[10px] font-mono text-slate-600">{new Date(m.date).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors truncate">{m.title}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mission Details */}
                <div className="lg:col-span-8">
                  {selectedHistoryMission ? (
                    <div className="space-y-6">
                      <div className="bg-slate-900/40 border border-slate-800 rounded p-8">
                        <h2 className="text-xl font-black tracking-widest text-white uppercase mb-2">{selectedHistoryMission.title}</h2>
                        <div className="text-[10px] font-mono text-cyan-500/60 uppercase tracking-widest mb-8">Deployment Date: {new Date(selectedHistoryMission.date).toLocaleDateString()}</div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500 flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5" />
                              Original Briefing
                            </h3>
                            <div className="prose prose-invert prose-xs max-w-none text-slate-400 font-sans leading-relaxed bg-black/20 p-4 rounded border border-slate-800/50">
                              <div className="markdown-body">
                                {selectedHistoryMission.situation ? (
                                  <div className="space-y-4">
                                    <section className="space-y-1">
                                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/60">Situation</h4>
                                      <div className="text-[10px] font-bold text-slate-500 mb-1">{selectedHistoryMission.location}</div>
                                      <div className="whitespace-pre-wrap text-slate-400">{selectedHistoryMission.situation}</div>
                                    </section>

                                    <section className="space-y-1">
                                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/60">Objectives</h4>
                                      <ul className="space-y-1">
                                        {JSON.parse(selectedHistoryMission.objectives || '[]').map((obj: string, i: number) => (
                                          <li key={i} className="flex gap-2">
                                            <span className="text-cyan-500/40 font-mono">{i + 1}.</span>
                                            <span className="text-slate-400">{obj}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </section>

                                    <section className="space-y-1">
                                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/60">Environment</h4>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                                        <div className="flex gap-1">
                                          <span className="text-slate-600 uppercase font-bold text-[10px] w-14">Terrain:</span>
                                          <span className="text-slate-500">{selectedHistoryMission.env_terrain}</span>
                                        </div>
                                        <div className="flex gap-1">
                                          <span className="text-slate-600 uppercase font-bold text-[10px] w-14">Time:</span>
                                          <span className="text-slate-500">{selectedHistoryMission.env_time}</span>
                                        </div>
                                        <div className="flex gap-1">
                                          <span className="text-slate-600 uppercase font-bold text-[10px] w-14">Weather:</span>
                                          <span className="text-slate-500">{selectedHistoryMission.env_weather}</span>
                                        </div>
                                        <div className="flex gap-1">
                                          <span className="text-slate-600 uppercase font-bold text-[10px] w-14">Forecast:</span>
                                          <span className="text-slate-500">{selectedHistoryMission.env_forecast}</span>
                                        </div>
                                      </div>
                                    </section>
                                  </div>
                                ) : (
                                  <Markdown>{selectedHistoryMission.description}</Markdown>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-500 flex items-center gap-2">
                              <Zap className="w-3.5 h-3.5" />
                              After Action Debrief
                            </h3>
                            <div className="prose prose-invert prose-xs max-w-none text-slate-200 font-sans leading-relaxed bg-green-500/5 p-4 rounded border border-green-500/20">
                              <div className="markdown-body">
                                <Markdown>{selectedHistoryMission.debrief || "_No debrief recorded for this operation._"}</Markdown>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-12 space-y-4">
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ListChecks className="w-3.5 h-3.5 text-cyan-500" />
                              Deployment Record
                            </div>
                            <div className="text-[10px] font-mono text-slate-600">
                              TOTAL PERSONNEL: {historyAttendance.length}
                            </div>
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {historyAttendance.map(entry => (
                              <div key={entry.id} className="flex items-center gap-2.5 bg-black/20 border border-slate-800/50 p-2 rounded">
                                <div 
                                  className="w-1 h-7 rounded-full" 
                                  style={{ backgroundColor: STATUS_COLORS[entry.status] || '#3b82f6' }} 
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] font-bold text-slate-300 truncate">{entry.name}</div>
                                  <div className="text-[10px] font-mono text-slate-500 uppercase truncate">{entry.role} // {entry.squad}</div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {isAdmin ? (
                                    <select 
                                      value={entry.status}
                                      onChange={(e) => {
                                        handleUpdateAttendance(entry.id, e.target.value);
                                      }}
                                      className="bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-tighter rounded px-1 py-0.5 focus:outline-none focus:border-cyan-500/50"
                                    >
                                      {Object.keys(STATUS_COLORS).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="text-[10px] font-mono text-slate-600 uppercase">
                                      {entry.status}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-slate-800 rounded bg-slate-900/20">
                      <Archive className="w-12 h-12 text-slate-700 mb-4" />
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Select an operation to view archive data</h3>
                      <p className="text-[10px] font-mono text-slate-600 mt-2">Historical records require authorization level 3 or higher</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'accounts' && isAdmin && (
            <motion.div
              key="accounts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="bg-slate-900/40 border border-slate-800 rounded p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-cyan-500/10 rounded border border-cyan-500/30">
                      <Key className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black tracking-widest text-white uppercase">Account Management</h2>
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Personnel Access Control</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input 
                        type="text"
                        placeholder="SEARCH ACCOUNTS..."
                        value={accountSearchTerm}
                        onChange={(e) => setAccountSearchTerm(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded pl-9 pr-4 py-2 text-[10px] font-mono text-white placeholder:text-slate-600 focus:border-cyan-500/50 outline-none transition-all w-64"
                      />
                    </div>
                    <button 
                      onClick={() => setIsCreatingUser(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 rounded text-cyan-400 text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-600/30 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Create Account
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users
                    .filter(u => {
                      const search = (accountSearchTerm || '').toLowerCase();
                      return (
                        (u.username || '').toLowerCase().includes(search) ||
                        (roster.find(m => m.id === u.roster_id)?.name || '').toLowerCase().includes(search) ||
                        (u.role || '').toLowerCase().includes(search)
                      );
                    })
                    .sort((a, b) => {
                      const rolePriority: Record<string, number> = { admin: 0, member: 1, guest: 2 };
                      const priorityA = rolePriority[(a.role || '').toLowerCase()] ?? 99;
                      const priorityB = rolePriority[(b.role || '').toLowerCase()] ?? 99;
                      if (priorityA !== priorityB) return priorityA - priorityB;
                      return (a.username || '').localeCompare(b.username || '');
                    })
                    .map(account => (
                      <div key={account.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded flex items-center justify-center ${account.role === 'admin' ? 'bg-cyan-500/20 text-cyan-400' : account.role === 'member' ? 'bg-slate-800 text-slate-300' : 'bg-slate-950/40 text-slate-600'}`}>
                            {account.role === 'admin' ? <Shield className="w-4 h-4" /> : account.role === 'guest' ? <Users className="w-4 h-4 opacity-50" /> : <Users className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{account.username}</div>
                            <div className="text-[10px] font-mono text-slate-500 uppercase">{account.role} // {roster.find(m => m.id === account.roster_id)?.name || 'Unlinked'}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => setEditingUser(account)}
                          className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-cyan-400 transition-all"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  {users.length === 0 && (
                    <div className="col-span-full py-12 text-center border border-dashed border-slate-800 rounded bg-slate-900/20">
                      <Users className="w-8 h-8 text-slate-700 mx-auto mb-3 opacity-20" />
                      <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">No accounts found in database</p>
                    </div>
                  )}
                  {users.length > 0 && users.filter(u => {
                    const search = (accountSearchTerm || '').toLowerCase();
                    return (
                      (u.username || '').toLowerCase().includes(search) ||
                      (roster.find(m => m.id === u.roster_id)?.name || '').toLowerCase().includes(search) ||
                      (u.role || '').toLowerCase().includes(search)
                    );
                  }).length === 0 && (
                    <div className="col-span-full py-12 text-center border border-dashed border-slate-800 rounded bg-slate-900/20">
                      <Search className="w-8 h-8 text-slate-700 mx-auto mb-3 opacity-20" />
                      <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">No accounts match your search criteria</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'documentation' && (
            <motion.div
              key="documentation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                  <BookOpen className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tighter text-white uppercase italic">Unit Documentation</h2>
                  <p className="text-[10px] font-mono text-slate-500 uppercase mt-1">Central Intelligence Hub // Knowledge Base</p>
                </div>
              </div>

              <div className="relative">
                {/* Vertical Divider */}
                <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-800/50 -translate-x-1/2" />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
                  {/* LEFT SIDE: UNIT RESOURCES & MODPACK */}
                  <div className="space-y-12">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-1 border-b border-slate-800 pb-4">
                        <Users className="w-4 h-4 text-cyan-500" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Unit Resources & Modpack</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[ 
                          { title: "Handbook", desc: "Your unit guide, which can answer most frequent questions" },
                          { title: "Basic Combat Training Guide", desc: "A refresher on the topics covered during your BCT" },
                          { title: "Medical Guide", desc: "A comprehensive guide for all things medical" },
                          { title: "ARMA III 'My Units'", desc: "Displays the unit logo and tag on player titles, uniforms, and vehicles" },
                          { title: "Approved Clientside Mods", desc: "List of allowed client-side modifications" },
                          { title: "Modpack V.1.2.4", desc: "Current Unit Modpack, updated Monthly", badges: ["Last Updated 26/JAN/26"] },
                          { title: "Donations", desc: "Server costs will be approximately $30/mo", badges: ["Provide name in Notes", "Send using Friends & Family"] },
                          { title: "Unit Patch Order Form", desc: "Hook & Loop Backed 3.5\" Woven Patch", badges: ["REMAINING : 7"] },
                        ].map((doc, i) => (
                          <div key={i} className="group bg-slate-900/40 border border-slate-800 p-5 rounded flex flex-col justify-between hover:border-cyan-500/30 transition-all min-h-[160px]">
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <h4 className="text-xs font-black text-slate-200 group-hover:text-cyan-400 transition-colors uppercase tracking-wider leading-tight">{doc.title}</h4>
                                {doc.badges && (
                                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                                    {doc.badges.map((b, bi) => (
                                      <span key={bi} className="text-[8px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] font-mono text-slate-500 leading-relaxed mb-4 uppercase">{doc.desc}</p>
                            </div>
                            <a href="#" className="inline-flex items-center gap-1.5 text-[10px] font-black text-cyan-500 uppercase tracking-widest hover:text-cyan-400 transition-colors mt-auto">
                              Click Here
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT SIDE: MISSION MAKING RESOURCES */}
                  <div className="space-y-12">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-1 border-b border-slate-800 pb-4">
                        <Wrench className="w-4 h-4 text-cyan-500" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Mission Making Resources</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { title: "Mission Making Guide", desc: "A comprehensive guide into the world of mission making" },
                          { title: "Mission Making Assets", desc: "Folders with music, sound files, and texture templates for common props" },
                          { title: "Scripts & Materials", desc: "Essential scripts and visual materials for mission development" },
                          { title: "UNSC Out of Shadow Composition", desc: "A quick-start resource with all playable slots, mission modules, current arsenal preset, etc" },
                          { title: "Modpack Planner", desc: "All upcoming modpack changes, including additions and removals" },
                          { title: "Basic Mission Setup", desc: "Core framework and settings for starting a new mission" },
                          { title: "Mission Schedule", desc: "Details the author, mission type, and completion status for upcoming projects" },
                        ].map((doc, i) => (
                          <div key={i} className="group bg-slate-900/40 border border-slate-800 p-5 rounded flex flex-col justify-between hover:border-cyan-500/30 transition-all min-h-[160px]">
                            <div>
                              <h4 className="text-xs font-black text-slate-200 group-hover:text-cyan-400 transition-colors uppercase tracking-wider leading-tight mb-3">{doc.title}</h4>
                              <p className="text-[10px] font-mono text-slate-500 leading-relaxed mb-4 uppercase">{doc.desc}</p>
                            </div>
                            <a href="#" className="inline-flex items-center gap-1.5 text-[10px] font-black text-cyan-500 uppercase tracking-widest hover:text-cyan-400 transition-colors mt-auto">
                              Click Here
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        ))}
                        
                        {/* Additional Resources List */}
                        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded flex flex-col justify-between min-h-[160px]">
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 mb-3">Additional Resources</div>
                            <ul className="space-y-2">
                              <li className="text-[10px] font-mono text-slate-500 flex items-center gap-2 group cursor-pointer hover:text-cyan-400 transition-colors uppercase">
                                <ChevronRight className="w-3 h-3 text-cyan-500" />
                                AI Generated Voice Lines
                              </li>
                              <li className="text-[10px] font-mono text-slate-500 flex items-center gap-2 group cursor-pointer hover:text-cyan-400 transition-colors uppercase">
                                <ChevronRight className="w-3 h-3 text-cyan-500" />
                                Mission Archive
                              </li>
                              <li className="text-[10px] font-mono text-slate-500 flex items-center gap-2 group cursor-pointer hover:text-cyan-400 transition-colors uppercase">
                                <ChevronRight className="w-3 h-3 text-cyan-500" />
                                Mission Timeline
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'login' && (
            <motion.div 
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto mt-20"
            >
              <div className="flex flex-col items-center gap-12">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500/20 blur-[100px] rounded-full" />
                  <div className="w-48 h-48 bg-slate-900/60 border border-slate-800 rounded-full flex items-center justify-center relative z-10">
                    <Shield className="w-24 h-24 text-cyan-500" />
                  </div>
                </div>
                
                <div className="space-y-4 text-center">
                  <h2 className="text-4xl font-black tracking-[0.2em] text-white uppercase italic">Havok Company - Task Force Warden</h2>
                  <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Office of Naval Intelligence // VISR Link</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                  {/* Member Login */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-6 shadow-2xl backdrop-blur-xl">
                    <div className="flex flex-col items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/40 rounded flex items-center justify-center">
                        <Users className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-lg font-black tracking-widest text-white uppercase">Member</h2>
                        <p className="text-xs font-mono text-slate-500 uppercase mt-1">Standard Access</p>
                      </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                      {authError && !guestUsername && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono p-3 rounded text-center uppercase">
                          {authError}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Username</label>
                        <input
                          type="text"
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          className="w-full bg-black/40 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
                        <input
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full bg-black/40 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded transition-all shadow-[0_0_20px_rgba(8,145,178,0.2)] uppercase tracking-[0.2em] text-xs"
                      >
                        Login
                      </button>
                    </form>
                  </div>

                  {/* Guest Login */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-6 shadow-2xl backdrop-blur-xl border-dashed">
                    <div className="flex flex-col items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded flex items-center justify-center">
                        <UserPlus className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-lg font-black tracking-widest text-white uppercase">Guest</h2>
                        <p className="text-xs font-mono text-slate-500 uppercase mt-1">Temporary Pass</p>
                      </div>
                    </div>

                    <form onSubmit={handleGuestLogin} className="space-y-4">
                      {authError && guestUsername && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono p-3 rounded text-center uppercase">
                          {authError}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Username</label>
                        <input
                          type="text"
                          value={guestUsername}
                          onChange={(e) => setGuestUsername(e.target.value)}
                          className="w-full bg-black/40 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
                        <input
                          type="password"
                          value={guestPassword}
                          onChange={(e) => setGuestPassword(e.target.value)}
                          className="w-full bg-black/40 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded transition-all uppercase tracking-[0.2em] text-xs"
                      >
                        Login
                      </button>
                    </form>
                  </div>

                  {/* Admin Login */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-6 shadow-2xl backdrop-blur-xl">
                    <div className="flex flex-col items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-red-500/10 border border-red-500/40 rounded flex items-center justify-center">
                        <Shield className="w-6 h-6 text-red-400" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-lg font-black tracking-widest text-white uppercase">Admin</h2>
                        <p className="text-xs font-mono text-slate-500 uppercase mt-1">Command Access</p>
                      </div>
                    </div>

                    <form onSubmit={handleAdminLogin} className="space-y-4">
                      {adminAuthError && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono p-3 rounded text-center uppercase">
                          {adminAuthError}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Username</label>
                        <input
                          type="text"
                          value={adminUsername}
                          onChange={(e) => setAdminUsername(e.target.value)}
                          className="w-full bg-black/40 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-red-500/50 transition-all"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
                        <input
                          type="password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          className="w-full bg-black/40 border border-slate-800 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-red-500/50 transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] uppercase tracking-[0.2em] text-xs"
                      >
                        Login
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'briefing' && (
            <motion.div 
              key="briefing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Top Row: Deployment Information & Quick Enlistment */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Deployment Information */}
                <div className="lg:col-span-8">
                  <div className="bg-slate-900/40 border border-slate-800 rounded p-6 h-full">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-cyan-500/10 rounded border border-cyan-500/30">
                          <Target className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <h2 className="text-sm font-black tracking-widest text-white uppercase">DEPLOYMENT INFORMATION</h2>
                          <div className="text-[10px] font-mono text-slate-500 uppercase">Active Campaign // Sector 4</div>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => setIsCreatingMission(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 rounded text-cyan-400 text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-600/30 transition-all"
                        >
                          <Target className="w-3.5 h-3.5" />
                          New Mission
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {missions.filter(m => m.status !== 'completed').map((mission) => (
                        <button
                          key={mission.id}
                          onClick={() => setSelectedMission(mission)}
                          className={`p-4 rounded border text-left transition-all relative group ${
                            selectedMission?.id === mission.id
                              ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold text-white truncate uppercase tracking-widest">{mission.title}</div>
                          <div className="text-xs font-mono text-slate-500 mt-2">{new Date(mission.date).toLocaleDateString()}</div>
                          
                          {isAdmin && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMission(mission);
                              }}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-cyan-400 transition-all"
                            >
                              <Info className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    
                    {/* Mission History Link */}
                    <div className="mt-6 pt-6 border-t border-slate-800">
                      <button 
                        onClick={() => setView('history')}
                        className="w-full flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800 rounded hover:border-cyan-500/30 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">Mission History Archive</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Enlistment */}
                <div className="lg:col-span-4">
                  <div className="bg-slate-900/40 border border-slate-800 rounded p-6 h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-cyan-500/10 rounded border border-cyan-500/30">
                        <UserPlus className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Quick Enlistment</h3>
                        <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5">Personnel: {user?.username}</p>
                      </div>
                    </div>

                    <div className="space-y-3 flex-1 flex flex-col justify-center">
                      <button
                        onClick={() => handleSignup('Attending')}
                        disabled={signingUp || !selectedMission}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-3 rounded transition-all flex items-center justify-center gap-2 uppercase tracking-[0.15em] text-xs"
                      >
                        {signingUp ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Confirm Attending
                      </button>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleSignup('Unsure')}
                          disabled={signingUp || !selectedMission}
                          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold py-3 rounded transition-all uppercase tracking-[0.15em] text-xs"
                        >
                          Unsure
                        </button>
                        <button
                          onClick={() => handleSignup('Not Attending')}
                          disabled={signingUp || !selectedMission}
                          className="bg-slate-800 hover:bg-red-900/40 hover:text-red-400 disabled:opacity-50 text-slate-300 font-bold py-3 rounded transition-all uppercase tracking-[0.15em] text-xs"
                        >
                          Absent
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        Uplink Established
                      </div>
                      {!selectedMission && (
                        <div className="text-[10px] font-mono text-red-500 uppercase animate-pulse">Select Mission First</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedMission && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Main Content: Briefing, Attachments, and Manifest */}
                  <div className="lg:col-span-12 space-y-6">
                    {/* Briefing Section */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-cyan-500" />
                          Mission Briefing
                        </h3>
                        {isAdmin && (
                          <button
                            onClick={() => handleCompleteMission(selectedMission.id)}
                            className="px-3 py-1 bg-green-600/20 border border-green-500/30 rounded text-green-400 text-xs font-bold uppercase tracking-widest hover:bg-green-600/30 transition-all flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Complete Mission
                          </button>
                        )}
                      </div>
                      <div className="prose prose-invert prose-xs max-w-none text-slate-300 font-sans leading-relaxed">
                        <div className="markdown-body">
                          {selectedMission.situation ? (
                            <div className="space-y-6">
                              <section className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-500/80">Situation</h4>
                                <div className="text-sm font-bold text-slate-400 mb-2">{selectedMission.location}</div>
                                <div className="whitespace-pre-wrap">{selectedMission.situation}</div>
                              </section>

                              <section className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-500/80">Objectives</h4>
                                <ul className="space-y-1.5">
                                  {JSON.parse(selectedMission.objectives || '[]').map((obj: string, i: number) => (
                                    <li key={i} className="flex gap-3">
                                      <span className="text-cyan-500/50 font-mono">{i + 1}.</span>
                                      <span>{obj}</span>
                                    </li>
                                  ))}
                                </ul>
                              </section>

                              <section className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-500/80">Environment</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                                  <div className="flex gap-2">
                                    <span className="text-slate-500 uppercase font-bold text-xs w-16">Terrain:</span>
                                    <span className="text-slate-300">{selectedMission.env_terrain}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-slate-500 uppercase font-bold text-xs w-16">Time:</span>
                                    <span className="text-slate-300">{selectedMission.env_time}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-slate-500 uppercase font-bold text-xs w-16">Weather:</span>
                                    <span className="text-slate-300">{selectedMission.env_weather}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-slate-500 uppercase font-bold text-xs w-16">Forecast:</span>
                                    <span className="text-slate-300">{selectedMission.env_forecast}</span>
                                  </div>
                                </div>
                              </section>
                            </div>
                          ) : (
                            <Markdown>{selectedMission.description}</Markdown>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Attachments Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                          <LayoutGrid className="w-3.5 h-3.5 text-cyan-500" />
                          Mission Attachments
                        </h3>
                        {isAdmin && (
                          <label className="cursor-pointer px-3 py-1 bg-cyan-600/20 border border-cyan-500/30 rounded text-cyan-400 text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-600/30 transition-all flex items-center gap-2">
                            <Plus className="w-3 h-3" />
                            Add Intel
                            <input 
                              type="file" 
                              className="hidden" 
                              onChange={handleUploadAttachment}
                            />
                          </label>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {missionAttachments.map(attachment => (
                          <div key={attachment.id} className="bg-slate-900/40 border border-slate-800 rounded p-3 flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-slate-500 group-hover:text-cyan-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[10px] font-bold text-slate-200 uppercase truncate">{attachment.original_name}</div>
                                <div className="text-[10px] font-mono text-slate-500 uppercase">{(attachment.size / 1024 / 1024).toFixed(1)}MB</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a 
                                href={`/uploads/${attachment.filename}`} 
                                download={attachment.original_name}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-cyan-400"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              {isAdmin && (
                                <button 
                                  onClick={() => handleDeleteAttachment(attachment.id)}
                                  className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {missionAttachments.length === 0 && (
                          <div className="col-span-full py-8 text-center border border-dashed border-slate-800 rounded bg-slate-900/10">
                            <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">No attachments available for this mission</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Deployment Manifest Section */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ListChecks className="w-3.5 h-3.5 text-cyan-500" />
                          Deployment Manifest
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono">
                          <span className="text-green-500">ACTIVE: {attendance.filter(a => a.status === 'Attended').length}</span>
                          <span className="text-cyan-500">SIGNED: {attendance.length}</span>
                        </div>
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {attendance.map(entry => {
                          const stats = getMemberStats(entry.name);
                          return (
                            <div key={entry.id} className="flex items-center gap-2.5 bg-slate-900/40 border border-slate-800 p-2 rounded group hover:border-cyan-500/30 transition-colors">
                              <div 
                                className="w-1 h-7 rounded-full shrink-0" 
                                style={{ backgroundColor: STATUS_COLORS[entry.status] || '#3b82f6' }} 
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="text-[10px] font-bold text-slate-200 truncate">{entry.name}</div>
                                    {stats.isSignedUp && (
                                      <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-600 shrink-0">{stats.completed} OPS</div>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 uppercase truncate">{entry.role} // {entry.squad}</div>
                              </div>
                              <div className="text-[10px] font-mono text-slate-600 uppercase shrink-0">
                                {isAdmin ? (
                                  <select
                                    value={entry.status}
                                    onChange={(e) => handleUpdateAttendance(entry.id, e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[9px] font-mono focus:border-cyan-500/50 outline-none transition-all cursor-pointer"
                                  >
                                    {Object.keys(STATUS_COLORS).map(status => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                ) : (
                                  entry.status
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-full mx-auto px-6 py-10 border-t border-slate-800/50 mt-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-mono text-slate-600 tracking-widest uppercase">
          <div>&copy; 2026 HAVOK COMPANY // TASK FORCE WARDEN</div>
          <div className="flex gap-8">
            <span className="hover:text-cyan-500 transition-colors cursor-pointer">Security Protocol 7-A</span>
            <span className="hover:text-cyan-500 transition-colors cursor-pointer">VISR Link v4.2.0</span>
            <span className="hover:text-cyan-500 transition-colors cursor-pointer">UNSC Encrypted</span>
          </div>
        </div>
      </footer>

      {/* Admin Modals */}
      <AnimatePresence>
        {(editingMember || isCreatingMember) && (
          <MemberModal 
            member={editingMember || { name: '', rank: '', squad: '1-1', team: 'Alpha', role: '', mos_abr: '' }} 
            onClose={() => { setEditingMember(null); setIsCreatingMember(false); }}
            onSave={handleSaveMember}
            onDelete={editingMember ? () => handleDeleteMember(editingMember.id) : undefined}
          />
        )}
        {(editingMission || isCreatingMission) && (
          <MissionModal 
            mission={editingMission || { title: '', description: '', date: new Date().toISOString().split('T')[0] }} 
            onClose={() => { setEditingMission(null); setIsCreatingMission(false); }}
            onSave={handleSaveMission}
            onDelete={editingMission ? () => handleDeleteMission(editingMission.id) : undefined}
          />
        )}
        {(editingUser || isCreatingUser) && (
          <AccountModal 
            account={editingUser || { username: '', role: 'member' }} 
            roster={roster}
            onClose={() => { setEditingUser(null); setIsCreatingUser(false); }}
            onSave={handleSaveUser}
            onDelete={editingUser ? () => handleDeleteUser(editingUser.id) : undefined}
          />
        )}
        {isChangingPassword && (
          <PasswordModal 
            onClose={() => setIsChangingPassword(false)}
            onSave={handleChangePassword}
            success={passwordChangeSuccess}
            error={authError}
          />
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.1);
          border-radius: 0px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.3);
        }
        body {
          background-image: radial-gradient(circle at 50% 50%, #0a0c10 0%, #050608 100%);
        }
        .markdown-body h3 {
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #06b6d4;
          font-size: 0.75rem;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          border-left: 2px solid #06b6d4;
          padding-left: 0.5rem;
        }
        .markdown-body p {
          margin-bottom: 1rem;
          font-size: 0.8rem;
          line-height: 1.6;
        }
        .markdown-body ul {
          list-style-type: none;
          padding-left: 0;
          margin-bottom: 1rem;
        }
        .markdown-body li {
          position: relative;
          padding-left: 1.25rem;
          margin-bottom: 0.25rem;
          font-size: 0.8rem;
        }
        .markdown-body li::before {
          content: '>';
          position: absolute;
          left: 0;
          color: #06b6d4;
          font-family: 'JetBrains Mono', monospace;
          font-weight: bold;
        }
        .markdown-body strong {
          color: #fff;
          font-weight: 800;
        }
      `}</style>
    </div>
  );
}
