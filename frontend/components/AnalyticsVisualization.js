import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { apiService } from '../services/apiService';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

const SEVERITY_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6']; // red, amber, green, blue
const STATUS_COLORS = ['#6366F1', '#FBBF24', '#34D399', '#EF4444']; // purple, yellow, green, red

const AnalyticsPage = () => {
  const [analyticsData, setAnalyticsData] = useState({
    severity_data: [],
    status_data: [],
    trend_data: [],
    unit_data: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Date filter state
  const [filterType, setFilterType] = useState('month'); // 'day', 'month', 'year'
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchAnalyticsData();
  }, [filterType, selectedDate]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Compute start_date and end_date based on filterType and selectedDate
      let start_date, end_date;
      if (filterType === 'day') {
        start_date = end_date = format(selectedDate, 'yyyy-MM-dd');
      } else if (filterType === 'month') {
        start_date = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
        end_date = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
      } else if (filterType === 'year') {
        start_date = format(startOfYear(selectedDate), 'yyyy-MM-dd');
        end_date = format(endOfYear(selectedDate), 'yyyy-MM-dd');
      }
      let data;
      if (start_date && end_date) {
        data = await apiService.getAnalyticsData('1year', start_date, end_date);
      } else {
        data = await apiService.getAnalyticsData('1year');
      }
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Filter trend_data based on selected date and filter type
  const filteredTrendData = useMemo(() => {
    if (!analyticsData?.trend_data) return [];

    return analyticsData.trend_data.filter(item => {
      const itemDate = parseISO(item.date); // your trend_data must have a 'date' field

      if (filterType === 'day') {
        return isWithinInterval(itemDate, {
          start: startOfDay(selectedDate),
          end: endOfDay(selectedDate),
        });
      } else if (filterType === 'month') {
        return isWithinInterval(itemDate, {
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate),
        });
      } else if (filterType === 'year') {
        return isWithinInterval(itemDate, {
          start: startOfYear(selectedDate),
          end: endOfYear(selectedDate),
        });
      }
      return true;
    });
  }, [analyticsData, filterType, selectedDate]);

  // Custom Tooltip for LineChart (trend)
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-sm">Value: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics & Visualizations</h1>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading analytics data...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics & Visualizations</h1>
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics & Visualizations</h1>

        {/* Date Filter Controls */}
        <div className="mb-6 flex items-center space-x-4">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border border-gray-300 rounded p-2"
          >
            <option value="day">Day</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>

          <input
            type={filterType === 'year' ? 'number' : 'date'}
            value={
              filterType === 'year'
                ? selectedDate.getFullYear()
                : format(selectedDate, 'yyyy-MM-dd')
            }
            onChange={e => {
              if (filterType === 'year') {
                const year = parseInt(e.target.value, 10);
                if (!isNaN(year)) {
                  setSelectedDate(new Date(year, 0, 1));
                }
              } else {
                setSelectedDate(new Date(e.target.value));
              }
            }}
            className="border border-gray-300 rounded p-2"
            min={filterType === 'year' ? 2000 : undefined}
            max={filterType === 'year' ? 2100 : undefined}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Anomalies by Severity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Anomalies by Severity</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analyticsData.severity_data}
                  dataKey="value"
                  nameKey="severity"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {analyticsData.severity_data.map((entry, index) => (
                    <Cell key={`cell-severity-${index}`} fill={SEVERITY_COLORS[index % SEVERITY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Anomalies by Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Anomalies by Status</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analyticsData.status_data}
                  dataKey="value"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {analyticsData.status_data.map((entry, index) => (
                    <Cell key={`cell-status-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Anomaly Trend with filtered data */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Anomaly Trend ({filterType.charAt(0).toUpperCase() + filterType.slice(1)})
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={filteredTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  domain={[0, 'dataMax + 2']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* You can add other charts here as needed */}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;