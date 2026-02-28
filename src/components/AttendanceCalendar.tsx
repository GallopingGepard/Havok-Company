import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Filter } from 'lucide-react';

interface RosterMember {
  id: number;
  name: string;
  rank: string;
  squad: string;
  team: string;
  role: string;
  mos_abr: string;
  display_order: number;
  loa_until?: string;
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
  squad?: string;
  role?: string;
}

interface Props {
  roster: RosterMember[];
  missions: Mission[];
  allAttendance: Attendance[];
  showDischargedOnly?: boolean;
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

export default function AttendanceCalendar({ roster, missions, allAttendance, showDischargedOnly }: Props) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<number>>(new Set());
  const [timeFilter, setTimeFilter] = useState<'all' | 'current' | '1m' | '3months' | '6months'>('all');

  const toggleMonth = (month: number) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const currentSundayStr = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = d.getDay();
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - dayOfWeek);
    const y = sunday.getFullYear();
    const m = String(sunday.getMonth() + 1).padStart(2, '0');
    const d2 = String(sunday.getDate()).padStart(2, '0');
    return `${y}-${m}-${d2}`;
  }, []);

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

  const filteredSundaysByMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (selectedYear !== currentYear && timeFilter !== 'all') {
      return sundaysByMonth;
    }

    if (timeFilter === 'current') {
      const monthSundays = sundaysByMonth[currentMonth] || [];
      const currentWeekSunday = monthSundays.find(s => {
        const y = s.getFullYear();
        const m = String(s.getMonth() + 1).padStart(2, '0');
        const d2 = String(s.getDate()).padStart(2, '0');
        return `${y}-${m}-${d2}` === currentSundayStr;
      });
      return currentWeekSunday ? { [currentMonth]: [currentWeekSunday] } : {};
    }

    if (timeFilter === '1m') {
      return { [currentMonth]: sundaysByMonth[currentMonth] || [] };
    }
    
    if (timeFilter === '3months') {
      const filtered: Record<number, Date[]> = {};
      // Last 3 months including current
      for (let i = 0; i < 3; i++) {
        const m = (currentMonth - i + 12) % 12;
        if (sundaysByMonth[m]) filtered[m] = sundaysByMonth[m];
      }
      return filtered;
    }

    if (timeFilter === '6months') {
      const filtered: Record<number, Date[]> = {};
      for (let i = 0; i < 6; i++) {
        const m = (currentMonth - i + 12) % 12;
        if (sundaysByMonth[m]) filtered[m] = sundaysByMonth[m];
      }
      return filtered;
    }

    return sundaysByMonth;
  }, [sundaysByMonth, timeFilter, selectedYear]);

  const visibleSundaysByMonth = useMemo(() => {
    const result: Record<number, Date[]> = {};
    Object.entries(filteredSundaysByMonth).forEach(([month, sundays]) => {
      const m = parseInt(month);
      if (!collapsedMonths.has(m)) {
        result[m] = sundays;
      }
    });
    return result;
  }, [filteredSundaysByMonth, collapsedMonths]);

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
      if (!rosterNames.has(a.name) && !a.name.includes('(Guest)') && a.squad !== 'Guest') {
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

    const allMembers = showDischargedOnly ? dischargedMembers : roster;

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
  }, [roster, allAttendance, missions, showDischargedOnly]);

  // Group roster by squad and team
  const groupedRoster = useMemo(() => {
    const groups: { squad: string, team: string, members: RosterMember[] }[] = [];
    
    if (showDischargedOnly) {
      if (memberAttendanceData.dischargedMembers.length > 0) {
        groups.push({
          squad: 'Attendance History (Discharged)',
          team: 'Attendance History (Discharged)',
          members: memberAttendanceData.dischargedMembers.sort((a, b) => a.name.localeCompare(b.name))
        });
      }
      return groups;
    }

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
    
    return groups;
  }, [roster, memberAttendanceData.dischargedMembers, showDischargedOnly]);

  const guestsBySunday = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    Object.keys(missionsBySunday).forEach(sundayStr => {
      const missionsOnSunday = missionsBySunday[sundayStr];
      const missionIds = missionsOnSunday.map(m => m.id);
      
      const guestsForWeek = new Set<string>();
      allAttendance.forEach(a => {
        if (missionIds.includes(a.mission_id) && (a.squad === 'Guest' || a.name.includes('(Guest)'))) {
          guestsForWeek.add(a.name);
        }
      });
      grouped[sundayStr] = Array.from(guestsForWeek).slice(0, 4);
    });
    return grouped;
  }, [missionsBySunday, allAttendance]);

  return (
    <div className="space-y-4 bg-slate-900/40 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black tracking-tighter text-white uppercase italic">
            {showDischargedOnly ? 'Attendance History (Discharged)' : 'Attendance Calendar'}
          </h2>
          
          <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded border border-slate-800/50">
            <Filter className="w-3 h-3 text-slate-500 ml-1 mr-1" />
            {(['all', 'current', '1m', '3months', '6months'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-all ${
                  timeFilter === f ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
              >
                {f === 'all' ? 'All' : f === 'current' ? 'Current' : f === '1m' ? '1M' : f === '3months' ? '3M' : '6M'}
              </button>
            ))}
          </div>

          {collapsedMonths.size > 0 && (
            <button 
              onClick={() => setCollapsedMonths(new Set())}
              className="text-[9px] font-black uppercase tracking-widest text-cyan-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
            >
              <Eye className="w-3 h-3" /> Expand All
            </button>
          )}
        </div>
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
              {Object.entries(visibleSundaysByMonth).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([month, sundays], monthIdx) => {
                const mInt = parseInt(month);
                const monthName = new Date(selectedYear, mInt, 1).toLocaleString('en-US', { month: 'long' });
                return (
                  <React.Fragment key={month}>
                    <th 
                      colSpan={sundays.length} 
                      className="border-b border-slate-800/50 px-2 py-1.5 font-black text-center text-slate-300 uppercase tracking-widest text-[10px]"
                    >
                      <div className="flex items-center justify-center gap-2">
                        {monthName}
                        <button 
                          onClick={() => toggleMonth(mInt)}
                          className="text-slate-600 hover:text-cyan-500 transition-colors p-0.5"
                          title="Collapse Month"
                        >
                          <EyeOff className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                    {monthIdx < Object.keys(visibleSundaysByMonth).length - 1 && (
                      <th className="w-2 border-b border-slate-800/50" rowSpan={2}></th>
                    )}
                  </React.Fragment>
                );
              })}
              {/* Collapsed Months Indicators */}
              {Object.entries(filteredSundaysByMonth).filter(([m]) => collapsedMonths.has(parseInt(m))).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([month]) => {
                const mInt = parseInt(month);
                const monthShort = new Date(selectedYear, mInt, 1).toLocaleString('en-US', { month: 'short' });
                return (
                  <React.Fragment key={month + '-collapsed'}>
                    <th className="w-6 border-b border-slate-800/50 p-0" rowSpan={2}>
                      <button 
                        onClick={() => toggleMonth(mInt)}
                        className="w-full h-full flex flex-col items-center justify-center gap-1 hover:bg-slate-800 transition-colors py-2"
                        title={`Expand ${monthShort}`}
                      >
                        <span className="[writing-mode:vertical-lr] text-[8px] font-black text-slate-600 uppercase tracking-tighter">{monthShort}</span>
                        <Eye className="w-2.5 h-2.5 text-cyan-500/50" />
                      </button>
                    </th>
                    <th className="w-1 border-b border-slate-800/50" rowSpan={2}></th>
                  </React.Fragment>
                );
              })}
            </tr>
            <tr>
              {Object.entries(visibleSundaysByMonth).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([month, sundays]) => {
                return (
                  <React.Fragment key={month + '-dates'}>
                    {sundays.map((sunday) => {
                      const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
                      const isCurrentWeek = sundayStr === currentSundayStr;
                      return (
                        <th 
                          key={sunday.toISOString()} 
                          className={`border-b border-slate-800/50 px-1 py-1.5 font-bold text-center w-8 text-[9px] transition-colors ${
                            isCurrentWeek ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-500'
                          }`}
                        >
                          {String(sunday.getDate()).padStart(2, '0')}
                        </th>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {groupedRoster.map((group, groupIdx) => (
              <React.Fragment key={`${group.squad}-${group.team}-${groupIdx}`}>
                {groupIdx > 0 && group.squad !== groupedRoster[groupIdx - 1].squad && group.squad !== 'Attendance History (Discharged)' && (
                  <tr className="h-6 !border-transparent bg-transparent">
                    <td colSpan={2 + Object.values(visibleSundaysByMonth).flat().length + Object.keys(visibleSundaysByMonth).length - 1 + (collapsedMonths.size * 2)}></td>
                  </tr>
                )}
                {group.squad === 'Attendance History (Discharged)' && (
                  <tr>
                    <td 
                      colSpan={2 + Object.values(visibleSundaysByMonth).flat().length + Object.keys(visibleSundaysByMonth).length - 1 + (collapsedMonths.size * 2)} 
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
                    {Object.entries(visibleSundaysByMonth).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([month, sundays], monthIdx) => {
                      return (
                        <React.Fragment key={month}>
                          {sundays.map((sunday) => {
                            const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
                            const isCurrentWeek = sundayStr === currentSundayStr;
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
                                className={`text-center font-bold relative p-0.5 ${isCurrentWeek ? 'bg-cyan-500/5' : ''}`}
                              >
                                <div 
                                  className={`w-full h-full min-h-[24px] flex items-center justify-center rounded-sm ${isCurrentWeek ? 'ring-1 ring-cyan-500/30' : ''}`}
                                  style={{ backgroundColor: cellColor, color: textColor }}
                                >
                                  {cellContent}
                                </div>
                              </td>
                            );
                          })}
                          {monthIdx < Object.keys(visibleSundaysByMonth).length - 1 && (
                            <td className="w-2"></td>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {/* Collapsed Months Cells */}
                    {Object.entries(filteredSundaysByMonth).filter(([m]) => collapsedMonths.has(parseInt(m))).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([month]) => (
                      <React.Fragment key={month + '-collapsed-cell'}>
                        <td className="bg-slate-950/30 border-r border-slate-800/50"></td>
                        <td className="w-2"></td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {/* Guests Section */}
            {!showDischargedOnly && (
              <>
                <tr className="h-6 !border-transparent bg-transparent">
                  <td colSpan={2 + Object.values(visibleSundaysByMonth).flat().length + Object.keys(visibleSundaysByMonth).length - 1 + (collapsedMonths.size * 2)}></td>
                </tr>
                <tr>
                  <td 
                    colSpan={2} 
                    className="bg-slate-900/80 text-slate-500 font-black text-left pl-4 py-3 uppercase tracking-[0.3em] border-y border-slate-800"
                  >
                    Guests
                  </td>
                  {Object.entries(visibleSundaysByMonth).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([month, sundays], monthIdx) => {
                    return (
                      <React.Fragment key={`guest-header-${month}`}>
                        <td colSpan={sundays.length} className="border-y border-slate-800"></td>
                        {monthIdx < Object.keys(visibleSundaysByMonth).length - 1 && (
                          <td className="w-2"></td>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {/* Collapsed Months Guest Header Cells */}
                  {Object.entries(filteredSundaysByMonth).filter(([m]) => collapsedMonths.has(parseInt(m))).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([month]) => (
                    <React.Fragment key={`guest-header-collapsed-${month}`}>
                      <td className="border-y border-slate-800"></td>
                      <td className="w-2"></td>
                    </React.Fragment>
                  ))}
                </tr>
                {[0, 1, 2, 3].map(rowIdx => (
                  <tr key={`guest-row-${rowIdx}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="border-r border-slate-800/50"></td>
                    <td className="font-bold px-3 py-1.5 whitespace-nowrap text-slate-200 border-r border-slate-800/50">
                    </td>
                    {Object.entries(visibleSundaysByMonth).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([month, sundays], monthIdx) => {
                      return (
                        <React.Fragment key={`guest-cells-${month}`}>
                          {sundays.map((sunday) => {
                            const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
                            const isCurrentWeek = sundayStr === currentSundayStr;
                            const guests = guestsBySunday[sundayStr] || [];
                            const guestName = guests[rowIdx];
                            
                            return (
                              <td 
                                key={`guest-${sunday.toISOString()}-${rowIdx}`} 
                                className={`text-center font-bold p-0.5 border-b border-slate-800/50 ${isCurrentWeek ? 'bg-cyan-500/5' : ''}`}
                              >
                                <div className={`w-full h-full min-h-[24px] flex items-center justify-center rounded-sm bg-slate-800/20 text-slate-300 text-[9px] truncate px-1 ${isCurrentWeek ? 'ring-1 ring-cyan-500/30' : ''}`}>
                                  {guestName || ''}
                                </div>
                              </td>
                            );
                          })}
                          {monthIdx < Object.keys(visibleSundaysByMonth).length - 1 && (
                            <td className="w-2"></td>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {/* Collapsed Months Guest Cells */}
                    {Object.entries(filteredSundaysByMonth).filter(([m]) => collapsedMonths.has(parseInt(m))).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([month]) => (
                      <React.Fragment key={`guest-collapsed-cell-${month}-${rowIdx}`}>
                        <td className="bg-slate-950/30 border-b border-slate-800/50"></td>
                        <td className="w-2"></td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
