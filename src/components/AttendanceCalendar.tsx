import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

interface Mission {
  id: number;
  title: string;
  date: string;
}

interface Attendance {
  id: number;
  mission_id: number;
  name: string;
  status: string;
}

interface Props {
  roster: RosterMember[];
  missions: Mission[];
  allAttendance: Attendance[];
}

const STATUS_COLORS: Record<string, string> = {
  'Attending': '#3b82f6',
  'Unsure': '#93c5fd',
  'Not Attending': '#ef4444',
  'Attended': '#22c55e',
  'Partial Attendance': '#86efac',
  'Absent (Reserves)': '#fde047',
  'Absent (LOA)': '#f97316',
  'Absent (Notice)': '#f97316', // Orange in image
  'Absent (No Notice)': '#ef4444', // Red in image
  'AWOL': '#7f1d1d', // Dark Red
};

const getSundayOfWeek = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dayOfWeek);
  
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, '0');
  const d2 = String(sunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d2}`;
};

const formatSunday = (date: Date) => {
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear().toString().slice(-2);
  return `${day}.${month}.${year}`;
};

const getTeamLabel = (squad: string, team: string) => {
  if (team === 'Command') {
    if (squad === '1-HQ') return 'HQ';
    return squad;
  }
  if (team === 'Alpha') return 'A';
  if (team === 'Bravo') return 'B';
  if (team === 'Charlie') return 'C';
  if (team === 'Delta') return 'D';
  return team || squad;
};

export default function AttendanceCalendar({ roster, missions, allAttendance }: Props) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const sundaysByMonth = useMemo(() => {
    const sundays = [];
    const d = new Date(selectedYear, 0, 1);
    while (d.getDay() !== 0) {
      d.setDate(d.getDate() + 1);
    }
    while (d.getFullYear() === selectedYear) {
      sundays.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }

    const grouped: Record<number, Date[]> = {};
    sundays.forEach(sunday => {
      const month = sunday.getMonth();
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(sunday);
    });
    return grouped;
  }, [selectedYear]);

  const missionsBySunday = useMemo(() => {
    const grouped: Record<string, Mission[]> = {};
    missions.forEach(m => {
      const sundayStr = getSundayOfWeek(m.date);
      if (!grouped[sundayStr]) grouped[sundayStr] = [];
      grouped[sundayStr].push(m);
    });
    return grouped;
  }, [missions]);

  const memberAttendanceData = useMemo(() => {
    const data: Record<string, any[]> = {};
    
    // Get all unique names from allAttendance that are not in roster and not guests
    const rosterNames = new Set(roster.map(m => m.name));
    const dischargedNames = new Set<string>();
    allAttendance.forEach(a => {
      if (!rosterNames.has(a.name) && !a.name.includes('(Guest)')) {
        dischargedNames.add(a.name);
      }
    });

    const dischargedMembers: RosterMember[] = Array.from(dischargedNames).map((name, idx) => ({
      id: -1000 - idx,
      name,
      rank: '',
      squad: 'Attendance History (Discharged)',
      team: '',
      role: '',
      mos_abr: '',
      display_order: 0
    }));

    const allMembers = [...roster, ...dischargedMembers];

    allMembers.forEach(member => {
      const memberAttendance = allAttendance.filter(a => a.name === member.name);
      const sortedAttendance = [...memberAttendance].sort((a, b) => {
        const missionA = missions.find(m => m.id === a.mission_id);
        const missionB = missions.find(m => m.id === b.mission_id);
        const dateA = missionA ? new Date(missionA.date).getTime() : 0;
        const dateB = missionB ? new Date(missionB.date).getTime() : 0;
        return dateA - dateB;
      });

      let count = 0;
      data[member.name] = sortedAttendance.map(a => {
        if (a.status === 'Attended' || a.status === 'Partial Attendance') {
          count++;
        }
        return { ...a, cumulativeCount: count };
      });
    });
    return { data, dischargedMembers };
  }, [roster, allAttendance, missions]);

  // Group roster by squad and team
  const groupedRoster = useMemo(() => {
    const groups: { squad: string, team: string, members: RosterMember[] }[] = [];
    let currentSquad = '';
    let currentTeam = '';
    let currentGroup: RosterMember[] = [];

    roster.forEach(member => {
      const squad = member.squad || '';
      const team = member.team || '';
      
      if (squad !== currentSquad || team !== currentTeam) {
        if (currentGroup.length > 0) {
          groups.push({ squad: currentSquad, team: currentTeam, members: currentGroup });
        }
        currentSquad = squad;
        currentTeam = team;
        currentGroup = [member];
      } else {
        currentGroup.push(member);
      }
    });
    if (currentGroup.length > 0) {
      groups.push({ squad: currentSquad, team: currentTeam, members: currentGroup });
    }
    
    // Add discharged members as a separate group
    if (memberAttendanceData.dischargedMembers.length > 0) {
      groups.push({
        squad: 'Attendance History (Discharged)',
        team: 'Attendance History (Discharged)',
        members: memberAttendanceData.dischargedMembers.sort((a, b) => a.name.localeCompare(b.name))
      });
    }
    
    return groups;
  }, [roster, memberAttendanceData.dischargedMembers]);

  return (
    <div className="space-y-4 bg-slate-900/40 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black tracking-tighter text-white uppercase italic">Attendance Calendar</h2>
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-white font-mono">{selectedYear}</span>
          <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <table className="w-max border-collapse font-mono text-[10px] text-slate-300">
          <thead>
            <tr>
              <th className="w-12 border-b border-slate-800/50 p-2" rowSpan={2}></th>
              <th className="w-40 border-b border-slate-800/50 p-2 text-left text-slate-500 uppercase tracking-widest align-bottom" rowSpan={2}>Personnel</th>
              {Object.entries(sundaysByMonth).map(([month, sundays], monthIdx) => {
                const monthName = new Date(selectedYear, parseInt(month), 1).toLocaleString('en-US', { month: 'long' });
                return (
                  <React.Fragment key={month}>
                    <th 
                      colSpan={sundays.length} 
                      className="border-b border-slate-800/50 px-2 py-1.5 font-black text-center text-slate-300 uppercase tracking-widest text-[10px]"
                    >
                      {monthName}
                    </th>
                    {monthIdx < Object.keys(sundaysByMonth).length - 1 && (
                      <th className="w-2 border-b border-slate-800/50" rowSpan={2}></th>
                    )}
                  </React.Fragment>
                );
              })}
            </tr>
            <tr>
              {Object.entries(sundaysByMonth).map(([month, sundays], monthIdx) => (
                <React.Fragment key={month + '-dates'}>
                  {sundays.map((sunday) => (
                    <th key={sunday.toISOString()} className="border-b border-slate-800/50 px-1 py-1.5 font-bold text-center w-8 text-slate-500 text-[9px]">
                      {String(sunday.getDate()).padStart(2, '0')}
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {groupedRoster.map((group, groupIdx) => (
              <React.Fragment key={`${group.squad}-${group.team}-${groupIdx}`}>
                {groupIdx > 0 && group.squad !== groupedRoster[groupIdx - 1].squad && group.squad !== 'Attendance History (Discharged)' && (
                  <tr className="h-6 !border-transparent bg-transparent">
                    <td colSpan={2 + Object.values(sundaysByMonth).flat().length + Object.keys(sundaysByMonth).length - 1}></td>
                  </tr>
                )}
                {group.squad === 'Attendance History (Discharged)' && (
                  <tr>
                    <td 
                      colSpan={2 + Object.values(sundaysByMonth).flat().length + Object.keys(sundaysByMonth).length - 1} 
                      className="bg-slate-900/80 text-slate-500 font-black text-left pl-4 py-3 uppercase tracking-[0.3em] border-y border-slate-800 mt-4"
                    >
                      Attendance History (Discharged)
                    </td>
                  </tr>
                )}
                {group.members.map((member, memberIdx) => (
                  <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="font-bold text-center px-2 py-1.5 text-cyan-500/70 text-[10px] uppercase tracking-widest border-r border-slate-800/50">
                      {group.squad === 'Attendance History (Discharged)' ? '' : (memberIdx === 0 ? getTeamLabel(group.squad, group.team) : '')}
                    </td>
                    <td className="font-bold px-3 py-1.5 whitespace-nowrap text-slate-200 border-r border-slate-800/50">
                      {member.name}
                    </td>
                    {Object.entries(sundaysByMonth).map(([month, sundays], monthIdx) => (
                      <React.Fragment key={month}>
                        {sundays.map((sunday) => {
                          const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
                          const missionsOnSunday = missionsBySunday[sundayStr];
                          const mission = missionsOnSunday ? missionsOnSunday[0] : null;
                          
                          let cellContent = null;
                          let cellColor = 'transparent';
                          let textColor = 'inherit';

                          if (mission) {
                            cellColor = 'rgba(30, 41, 59, 0.5)'; // slate-800/50
                            const attendanceRecord = memberAttendanceData.data[member.name]?.find(a => a.mission_id === mission.id);
                            if (attendanceRecord) {
                              cellColor = STATUS_COLORS[attendanceRecord.status] || cellColor;
                              if (attendanceRecord.status === 'Attended' || attendanceRecord.status === 'Partial Attendance') {
                                cellContent = attendanceRecord.cumulativeCount;
                                textColor = '#000000'; // Dark text for light backgrounds
                              } else {
                                textColor = 'rgba(0,0,0,0.6)'; // Slightly faded dark text for other statuses
                              }
                            }
                          }

                          return (
                            <td 
                              key={sunday.toISOString()} 
                              className="text-center font-bold relative p-0.5"
                            >
                              <div 
                                className="w-full h-full min-h-[24px] flex items-center justify-center rounded-sm"
                                style={{ backgroundColor: cellColor, color: textColor }}
                              >
                                {cellContent}
                              </div>
                            </td>
                          );
                        })}
                        {monthIdx < Object.keys(sundaysByMonth).length - 1 && (
                          <td className="w-2"></td>
                        )}
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
