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
    roster.forEach(member => {
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
    return data;
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
    return groups;
  }, [roster]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black tracking-tighter text-white uppercase italic">Attendance Calendar</h2>
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-slate-800 rounded">
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>
          <span className="text-lg font-bold text-white font-mono">{selectedYear}</span>
          <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-slate-800 rounded">
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <table className="w-max border-collapse bg-black text-black font-sans text-[11px]">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th className="w-32"></th>
              {Object.entries(sundaysByMonth).map(([month, sundays], monthIdx) => (
                <React.Fragment key={month}>
                  {sundays.map((sunday) => (
                    <th key={sunday.toISOString()} className="border-2 border-black bg-white px-2 py-1 font-bold text-center w-20">
                      {formatSunday(sunday)}
                    </th>
                  ))}
                  {monthIdx < Object.keys(sundaysByMonth).length - 1 && (
                    <th className="w-4 bg-black border-none"></th>
                  )}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedRoster.map((group, groupIdx) => (
              <React.Fragment key={`${group.squad}-${group.team}-${groupIdx}`}>
                {group.members.map((member, memberIdx) => (
                  <tr key={member.id}>
                    <td className="border-2 border-black bg-white font-bold text-center px-1">
                      {memberIdx === 0 ? (group.team || group.squad) : ''}
                    </td>
                    <td className="border-2 border-black bg-white font-bold px-2 whitespace-nowrap">
                      {member.name}
                    </td>
                    {Object.entries(sundaysByMonth).map(([month, sundays], monthIdx) => (
                      <React.Fragment key={month}>
                        {sundays.map((sunday) => {
                          const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
                          const missionsOnSunday = missionsBySunday[sundayStr];
                          const mission = missionsOnSunday ? missionsOnSunday[0] : null;
                          
                          let cellContent = null;
                          let cellColor = '#ffffff';

                          if (mission) {
                            const attendanceRecord = memberAttendanceData[member.name]?.find(a => a.mission_id === mission.id);
                            if (attendanceRecord) {
                              cellColor = STATUS_COLORS[attendanceRecord.status] || '#ffffff';
                              if (attendanceRecord.status === 'Attended' || attendanceRecord.status === 'Partial Attendance') {
                                cellContent = attendanceRecord.cumulativeCount;
                              }
                            }
                          }

                          return (
                            <td 
                              key={sunday.toISOString()} 
                              className="border-2 border-black text-center font-bold"
                              style={{ backgroundColor: cellColor }}
                            >
                              {cellContent}
                            </td>
                          );
                        })}
                        {monthIdx < Object.keys(sundaysByMonth).length - 1 && (
                          <td className="bg-black border-none"></td>
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
