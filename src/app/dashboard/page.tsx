'use client';

import { useEffect, useState } from 'react';

interface Student {
  id: string;
  name: string;
  email: string;
  program: string;
  outreach_status: string;
  status: string;
  email_sent_date: string | null;
  days_since_contact: number | null;
  pending_items: string[];
  staff_notes: string;
  accepted_date: string | null;
  tier: string;
  last_click_days: number | null;
}

interface DashboardData {
  students: Student[];
  stats: {
    total: number;
    needs_outreach: number;
    conditional: number;
    accepted_last_30: number;
  };
}

type TabKey = 'needs_outreach' | 'conditional' | 'recently_accepted';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('needs_outreach');
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogCall(studentId: string) {
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_call', studentId }),
      });
      fetchData();
    } catch {
      alert('Failed to log call');
    }
  }

  async function handleAddNote(studentId: string) {
    const note = notes[studentId];
    if (!note?.trim()) return;
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_note', studentId, note }),
      });
      setNotes((prev) => ({ ...prev, [studentId]: '' }));
      fetchData();
    } catch {
      alert('Failed to add note');
    }
  }

  async function handleMarkReceived(studentId: string) {
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_received', studentId }),
      });
      fetchData();
    } catch {
      alert('Failed to mark as received');
    }
  }

  async function handleExport() {
    try {
      const res = await fetch('/api/dashboard/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dashboard_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export CSV');
    }
  }

  // Filtered lists
  const needsOutreach = data?.students.filter((s) => s.outreach_status === 'needed') || [];
  const conditional = data?.students.filter((s) => s.status === 'conditional') || [];
  const recentlyAccepted = data?.students.filter((s) => {
    if (!s.accepted_date) return false;
    const accepted = new Date(s.accepted_date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return accepted >= thirtyDaysAgo;
  }) || [];

  // Styles
  const colors = {
    primaryGreen: '#0F603D',
    gold: '#FFC522',
    darkGreen: '#033F2B',
    white: '#FFFFFF',
    lightGray: '#F5F5F5',
    red: '#D32F2F',
    borderGray: '#E0E0E0',
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: colors.white,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      backgroundColor: colors.primaryGreen,
      padding: '20px 32px',
      borderBottom: `4px solid ${colors.gold}`,
    },
    headerTitle: {
      color: colors.white,
      fontSize: '24px',
      fontWeight: 700,
      margin: 0,
    },
    statsBar: {
      display: 'flex',
      gap: '24px',
      padding: '16px 32px',
      backgroundColor: colors.lightGray,
      borderBottom: `1px solid ${colors.borderGray}`,
    },
    statItem: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
    },
    statValue: {
      fontSize: '28px',
      fontWeight: 700,
      color: colors.darkGreen,
    },
    statLabel: {
      fontSize: '12px',
      color: '#666',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
    },
    tabBar: {
      display: 'flex',
      gap: '0',
      padding: '0 32px',
      borderBottom: `1px solid ${colors.borderGray}`,
      backgroundColor: colors.white,
    },
    tab: {
      padding: '12px 24px',
      cursor: 'pointer',
      border: 'none',
      background: 'none',
      fontSize: '14px',
      fontWeight: 600,
      color: '#666',
      borderBottom: '3px solid transparent',
      transition: 'all 0.2s',
    },
    tabActive: {
      color: colors.primaryGreen,
      borderBottom: `3px solid ${colors.gold}`,
    },
    content: {
      flex: 1,
      padding: '24px 32px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '14px',
    },
    th: {
      textAlign: 'left' as const,
      padding: '10px 12px',
      backgroundColor: colors.darkGreen,
      color: colors.white,
      fontWeight: 600,
      fontSize: '12px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
    },
    td: {
      padding: '10px 12px',
      borderBottom: `1px solid ${colors.borderGray}`,
      verticalAlign: 'middle' as const,
    },
    rowHighlight: {
      backgroundColor: '#FFEBEE',
    },
    button: {
      padding: '6px 14px',
      backgroundColor: colors.primaryGreen,
      color: colors.white,
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: 600,
    },
    buttonGold: {
      padding: '6px 14px',
      backgroundColor: colors.gold,
      color: colors.darkGreen,
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: 600,
    },
    noteInput: {
      padding: '6px 10px',
      border: `1px solid ${colors.borderGray}`,
      borderRadius: '4px',
      fontSize: '13px',
      width: '180px',
      marginRight: '8px',
    },
    footer: {
      padding: '16px 32px',
      borderTop: `1px solid ${colors.borderGray}`,
      display: 'flex',
      justifyContent: 'flex-end',
      backgroundColor: colors.lightGray,
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '60px',
      fontSize: '16px',
      color: '#666',
    },
    badge: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
    },
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>GWC Student Outreach Dashboard</h1>
        </header>
        <div style={styles.loading}>Loading dashboard data…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>GWC Student Outreach Dashboard</h1>
        </header>
        <div style={{ ...styles.loading, color: colors.red }}>Error: {error}</div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'needs_outreach', label: 'Needs Outreach' },
    { key: 'conditional', label: 'Conditional' },
    { key: 'recently_accepted', label: 'Recently Accepted' },
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>GWC Student Outreach Dashboard</h1>
      </header>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{data?.stats.total ?? 0}</span>
          <span style={styles.statLabel}>Total Students</span>
        </div>
        <div style={styles.statItem}>
          <span style={{ ...styles.statValue, color: colors.red }}>
            {data?.stats.needs_outreach ?? 0}
          </span>
          <span style={styles.statLabel}>Needs Outreach</span>
        </div>
        <div style={styles.statItem}>
          <span style={{ ...styles.statValue, color: '#F57C00' }}>
            {data?.stats.conditional ?? 0}
          </span>
          <span style={styles.statLabel}>Conditional</span>
        </div>
        <div style={styles.statItem}>
          <span style={{ ...styles.statValue, color: colors.primaryGreen }}>
            {data?.stats.accepted_last_30 ?? 0}
          </span>
          <span style={styles.statLabel}>Accepted (Last 30 Days)</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.tabActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Tab 1: Needs Outreach */}
        {activeTab === 'needs_outreach' && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Program</th>
                <th style={styles.th}>Email Sent</th>
                <th style={styles.th}>Days Since</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {needsOutreach.length === 0 && (
                <tr>
                  <td style={{ ...styles.td, textAlign: 'center' }} colSpan={7}>
                    No students currently need outreach.
                  </td>
                </tr>
              )}
              {needsOutreach.map((student) => {
                const isOverdue = (student.last_click_days ?? 0) > 5;
                return (
                  <tr key={student.id} style={isOverdue ? styles.rowHighlight : {}}>
                    <td style={styles.td}>{student.name}</td>
                    <td style={styles.td}>{student.email}</td>
                    <td style={styles.td}>{student.program}</td>
                    <td style={styles.td}>
                      {student.email_sent_date
                        ? new Date(student.email_sent_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: isOverdue ? '#FFCDD2' : '#C8E6C9',
                          color: isOverdue ? colors.red : colors.primaryGreen,
                        }}
                      >
                        {student.days_since_contact ?? '—'} days
                      </span>
                    </td>
                    <td style={styles.td}>{student.outreach_status}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          style={styles.button}
                          onClick={() => handleLogCall(student.id)}
                        >
                          Log Call
                        </button>
                        <input
                          type="text"
                          placeholder="Add note…"
                          style={styles.noteInput}
                          value={notes[student.id] || ''}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddNote(student.id);
                          }}
                        />
                        <button
                          style={styles.buttonGold}
                          onClick={() => handleAddNote(student.id)}
                        >
                          Save
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Tab 2: Conditional */}
        {activeTab === 'conditional' && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Program</th>
                <th style={styles.th}>Pending Items</th>
                <th style={styles.th}>Staff Notes</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {conditional.length === 0 && (
                <tr>
                  <td style={{ ...styles.td, textAlign: 'center' }} colSpan={5}>
                    No conditional students.
                  </td>
                </tr>
              )}
              {conditional.map((student) => (
                <tr key={student.id}>
                  <td style={styles.td}>{student.name}</td>
                  <td style={styles.td}>{student.program}</td>
                  <td style={styles.td}>
                    {student.pending_items && student.pending_items.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '16px' }}>
                        {student.pending_items.map((item, idx) => (
                          <li key={idx} style={{ marginBottom: '2px' }}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={styles.td}>{student.staff_notes || '—'}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Add note…"
                        style={styles.noteInput}
                        value={notes[student.id] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddNote(student.id);
                        }}
                      />
                      <button
                        style={styles.buttonGold}
                        onClick={() => handleAddNote(student.id)}
                      >
                        Save
                      </button>
                      <button
                        style={styles.button}
                        onClick={() => handleMarkReceived(student.id)}
                      >
                        Mark Received
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Tab 3: Recently Accepted */}
        {activeTab === 'recently_accepted' && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Program</th>
                <th style={styles.th}>Accepted Date</th>
                <th style={styles.th}>Tier</th>
                <th style={styles.th}>Email</th>
              </tr>
            </thead>
            <tbody>
              {recentlyAccepted.length === 0 && (
                <tr>
                  <td style={{ ...styles.td, textAlign: 'center' }} colSpan={5}>
                    No recently accepted students.
                  </td>
                </tr>
              )}
              {recentlyAccepted.map((student) => (
                <tr key={student.id}>
                  <td style={styles.td}>{student.name}</td>
                  <td style={styles.td}>{student.program}</td>
                  <td style={styles.td}>
                    {student.accepted_date
                      ? new Date(student.accepted_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor: colors.gold,
                        color: colors.darkGreen,
                      }}
                    >
                      {student.tier}
                    </span>
                  </td>
                  <td style={styles.td}>{student.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <button style={styles.button} onClick={handleExport}>
          Export to CSV
        </button>
      </footer>
    </div>
  );
}
