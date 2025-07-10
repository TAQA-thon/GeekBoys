import React, { useEffect, useState } from 'react';
import apiService from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const STATUS_COLORS = ['#1976d2', '#388e3c', '#fbc02d', '#d32f2f', '#7b1fa2'];
const CRITICALITY_COLORS = ['#d32f2f', '#fbc02d', '#388e3c', '#1976d2'];

export default function Report() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [byStatus, setByStatus] = useState([]);
  const [byCriticality, setByCriticality] = useState([]);
  const [bySection, setBySection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const summaryRes = await apiService.get('/anomalies/report/summary/');
        const trendsRes = await apiService.get('/anomalies/report/trends/');
        const byStatusRes = await apiService.get('/anomalies/report/by-status/');
        const byCriticalityRes = await apiService.get('/anomalies/report/by-criticality/');
        const bySectionRes = await apiService.get('/anomalies/report/by-section/');
        setSummary(summaryRes);
        setTrends(trendsRes);
        setByStatus(byStatusRes);
        setByCriticality(byCriticalityRes);
        setBySection(bySectionRes);
      } catch (err) {
        setError('Failed to load report data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading report...</div>;
  }
  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }
  if (!summary || typeof summary !== 'object' || summary.total_anomalies === undefined) {
    return <div className="p-8 text-red-600">Failed to load report data (malformed response).</div>;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white rounded shadow p-6 text-center">
          <div className="text-2xl font-bold">{summary.total_anomalies}</div>
          <div className="text-gray-600">Total Anomalies</div>
        </div>
        <div className="bg-white rounded shadow p-6 text-center">
          <div className="text-2xl font-bold">{summary.open_anomalies}</div>
          <div className="text-gray-600">Open Anomalies</div>
        </div>
        <div className="bg-white rounded shadow p-6 text-center">
          <div className="text-2xl font-bold">{summary.resolved_anomalies}</div>
          <div className="text-gray-600">Resolved Anomalies</div>
        </div>
        <div className="bg-white rounded shadow p-6 text-center">
          <div className="text-2xl font-bold">{summary.critical_anomalies}</div>
          <div className="text-gray-600">Critical Anomalies</div>
        </div>
        <div className="bg-white rounded shadow p-6 text-center col-span-2 md:col-span-4">
          <div className="text-2xl font-bold">{summary.avg_resolution_time} days</div>
          <div className="text-gray-600">Average Resolution Time</div>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="bg-white rounded shadow p-6">
        <div className="font-semibold mb-2">Anomalies Over Time</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tickFormatter={d => d} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* By Status Chart */}
      <div className="bg-white rounded shadow p-6">
        <div className="font-semibold mb-2">Anomalies by Status</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byStatus} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#1976d2" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By Criticality Chart */}
      <div className="bg-white rounded shadow p-6">
        <div className="font-semibold mb-2">Anomalies by Criticality</div>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={byCriticality}
              dataKey="count"
              nameKey="condition"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {byCriticality.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={CRITICALITY_COLORS[idx % CRITICALITY_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* By Section Table */}
      <div className="bg-white rounded shadow p-6">
        <div className="font-semibold mb-2">Anomalies by Section</div>
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2">Section</th>
              <th className="text-left p-2">Total</th>
              <th className="text-left p-2">Resolved</th>
              <th className="text-left p-2">Avg. Resolution Time (days)</th>
            </tr>
          </thead>
          <tbody>
            {bySection.map((row) => (
              <tr key={row.section}>
                <td className="p-2">{row.section}</td>
                <td className="p-2">{row.total}</td>
                <td className="p-2">{row.resolved}</td>
                <td className="p-2">{row.avg_resolution_time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 