import React, { useEffect, useState, useMemo } from 'react';
import apiService from '../services/api';
import { apiService as analyticsApiService } from '../services/apiService';
import { AlertCircle, Loader, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
} from 'recharts';
import {
  addDays,
  format,
  eachDayOfInterval,
  eachMonthOfInterval,
  parseISO,
  isValid,
} from 'date-fns';
import { Calendar, Filter } from 'lucide-react';
import { useRef } from 'react';

const STATUS_COLORS = ['#1976d2', '#388e3c', '#fbc02d', '#d32f2f', '#7b1fa2'];
const CRITICALITY_COLORS = ['#d32f2f', '#fbc02d', '#388e3c', '#1976d2'];
const SEVERITY_COLORS = ['#1976d2', '#388e3c', '#fbc02d', '#d32f2f', '#7b1fa2'];
const UNIT_COLORS = [
  '#1976d2',
  '#388e3c',
  '#fbc02d',
  '#d32f2f',
  '#7b1fa2',
  '#ff9800',
  '#009688',
  '#e91e63',
];

// Month names for display
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper function to parse date from various formats
const parseDate = (dateString) => {
  if (!dateString) return null;
  const isoDate = parseISO(dateString);
  if (isValid(isoDate)) return isoDate;
  const regularDate = new Date(dateString);
  if (isValid(regularDate)) return regularDate;
  return null;
};

// Helper function to filter data by date including year, month, day
const filterDataByDate = (data, dateField = 'date') => {
  if (!data || !Array.isArray(data)) return [];
  return data.filter((item) => {
    const itemDate = parseDate(item[dateField] || item.created_at || item.date);
    if (!itemDate) return true;
    const itemMonth = itemDate.getMonth() + 1;
    const itemDay = itemDate.getDate();
    const itemYear = itemDate.getFullYear();
    const yearMatch = selectedYear === 'all' || itemYear === parseInt(selectedYear);
    const monthMatch = selectedMonth === 'all' || itemMonth === parseInt(selectedMonth);
    const dayMatch = selectedDay === 'all' || itemDay === parseInt(selectedDay);
    return yearMatch && monthMatch && dayMatch;
  });
};

// Helper to get full date/month range for Resolved Over Time chart
function getResolvedOverTimeRange(selectedYear, selectedMonth, selectedDay, earliestDate, nowDate) {
  let start_date, end_date;
  if (selectedYear !== 'all' && selectedMonth !== 'all' && selectedDay !== 'all') {
    start_date = end_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  } else if (selectedYear !== 'all' && selectedMonth !== 'all') {
    start_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    end_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else if (selectedYear !== 'all') {
    start_date = `${selectedYear}-01-01`;
    end_date = `${selectedYear}-12-31`;
  } else {
    // No filter: use earliest anomaly and now
    start_date = earliestDate ? format(parseISO(earliestDate), 'yyyy-MM-dd') : format(addDays(new Date(), -365), 'yyyy-MM-dd');
    end_date = format(nowDate, 'yyyy-MM-dd');
  }
  return { start_date, end_date };
}

export default function AnalyticsReport() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [byStatus, setByStatus] = useState([]);
  const [byCriticality, setByCriticality] = useState([]);
  const [bySection, setBySection] = useState([]);
  const [analyticsData, setAnalyticsData] = useState({
    severity_data: [],
    status_data: [],
    trend_data: [],
    unit_data: [],
  });
  
  // Debug analyticsData changes
  useEffect(() => {
    console.log('analyticsData state changed:', analyticsData);
  }, [analyticsData]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFrame, setTimeFrame] = useState('monthly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [earliestDate, setEarliestDate] = useState(null);
  const [nowDate, setNowDate] = useState(() => new Date());
  const [yearlyTrendData, setYearlyTrendData] = useState([]);

  // Date filtering states
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedDay, setSelectedDay] = useState('all');

  // Compute available years, months, and days based on current selection
  const { availableYears, availableMonths, availableDays } = useMemo(() => {
    const years = new Set();
    const months = new Set();
    const days = new Set();

    // Helper to parse date
    const parse = (item) => parseDate(item.date || item.created_at);

    // Collect all dates
    const allData = [
      ...analyticsData.severity_data,
      ...analyticsData.status_data,
      ...analyticsData.unit_data,
      ...byStatus,
      ...byCriticality,
      ...bySection,
    ];

    allData.forEach((item) => {
      const date = parse(item);
      if (!date) return;
      years.add(date.getFullYear());
      if (selectedYear === 'all' || date.getFullYear() === parseInt(selectedYear)) {
        months.add(date.getMonth() + 1);
        if (
          (selectedMonth === 'all' || date.getMonth() + 1 === parseInt(selectedMonth)) &&
          (selectedYear === 'all' || date.getFullYear() === parseInt(selectedYear))
        ) {
          days.add(date.getDate());
        }
      }
    });

    return {
      availableYears: Array.from(years).sort((a, b) => a - b),
      availableMonths: Array.from(months).sort((a, b) => a - b),
      availableDays: Array.from(days).sort((a, b) => a - b),
    };
  }, [analyticsData, byStatus, byCriticality, bySection, selectedYear, selectedMonth]);

  // Reset lower-level filters when higher-level filter changes
  useEffect(() => {
    setSelectedMonth('all');
    setSelectedDay('all');
  }, [selectedYear]);

  useEffect(() => {
    setSelectedDay('all');
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line
  }, [selectedYear, selectedMonth, selectedDay, earliestDate, nowDate]);

  // Fetch the earliest anomaly date on mount
  useEffect(() => {
    const fetchEarliestDate = async () => {
      try {
        console.log('Fetching earliest date...');
        const res = await apiService.get('/anomalies/earliest-date/');
        console.log('Earliest date response:', res);
        if (res && res.earliest_date) {
          setEarliestDate(res.earliest_date);
        }
        console.log('Earliest date set to:', res.earliest_date);
      } catch (err) {
        console.error('Error fetching earliest date:', err);
        // fallback: use 1 year ago
        setEarliestDate(format(addDays(new Date(), -365), 'yyyy-MM-dd'));
      }
    };
    fetchEarliestDate();
    setNowDate(new Date());
  }, []);

  async function fetchAllData() {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching summary data...');
      const summaryRes = await apiService.get('/anomalies/report/summary/');
      console.log('Summary response:', summaryRes);
      
      console.log('Fetching by-status data...');
      const byStatusRes = await apiService.get('/anomalies/report/by-status/');
      console.log('By-status response:', byStatusRes);
      
      console.log('Fetching by-criticality data...');
      const byCriticalityRes = await apiService.get('/anomalies/report/by-criticality/');
      console.log('By-criticality response:', byCriticalityRes);
      
      console.log('Fetching by-section data...');
      const bySectionRes = await apiService.get('/anomalies/report/by-section/');
      console.log('By-section response:', bySectionRes);
      
      setSummary(summaryRes);
      setByStatus(byStatusRes);
      setByCriticality(byCriticalityRes);
      setBySection(bySectionRes);

      console.log('Fetching analytics data...');
      // Use the same date range logic as fetchFilteredAnalytics
      let analytics_start_date, analytics_end_date;
      if (selectedYear !== 'all' && selectedMonth !== 'all' && selectedDay !== 'all') {
        // Single day
        analytics_start_date = analytics_end_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      } else if (selectedYear !== 'all' && selectedMonth !== 'all') {
        // Whole month
        analytics_start_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        // Calculate last day of month
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        analytics_end_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else if (selectedYear !== 'all') {
        // Whole year
        analytics_start_date = `${selectedYear}-01-01`;
        analytics_end_date = `${selectedYear}-12-31`;
      } else if (earliestDate) {
        // No filter: use earliest anomaly date from endpoint
        analytics_start_date = format(parseISO(earliestDate), 'yyyy-MM-dd');
        analytics_end_date = format(nowDate, 'yyyy-MM-dd');
      } else {
        // If earliestDate is not yet loaded, use default range
        analytics_start_date = format(addDays(new Date(), -365), 'yyyy-MM-dd');
        analytics_end_date = format(new Date(), 'yyyy-MM-dd');
      }
      
      const analyticsParams = [];
      if (analytics_start_date && analytics_end_date) {
        analyticsParams.push(`start_date=${analytics_start_date}`);
        analyticsParams.push(`end_date=${analytics_end_date}`);
      }
      const analyticsUrl = `/anomalies/report/analytics/?${analyticsParams.join('&')}`;
      console.log('Fetching analytics data from:', analyticsUrl);
      const analytics = await apiService.get(analyticsUrl);
      console.log('Analytics response:', analytics);
      setAnalyticsData(analytics);

      // Use the same date range logic as analytics for trends
      let start_date, end_date;
      if (selectedYear !== 'all' && selectedMonth !== 'all' && selectedDay !== 'all') {
        // Single day
        start_date = end_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      } else if (selectedYear !== 'all' && selectedMonth !== 'all') {
        // Whole month
        start_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        // Calculate last day of month
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        end_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else if (selectedYear !== 'all') {
        // Whole year
        start_date = `${selectedYear}-01-01`;
        end_date = `${selectedYear}-12-31`;
      } else if (earliestDate) {
        // No filter: use earliest anomaly date from endpoint
        start_date = format(parseISO(earliestDate), 'yyyy-MM-dd');
        end_date = format(nowDate, 'yyyy-MM-dd');
      } else {
        // If earliestDate is not yet loaded, use default range
        start_date = format(addDays(new Date(), -365), 'yyyy-MM-dd');
        end_date = format(new Date(), 'yyyy-MM-dd');
      }

      let trendsEndpoint = '/anomalies/report/trends/?status=resolved';
      if (start_date && end_date) {
        trendsEndpoint += `&start=${start_date}&end=${end_date}`;
      }
      console.log('Fetching trends from:', trendsEndpoint);
      const trendsRes = await apiService.get(trendsEndpoint);
      console.log('Trends response:', trendsRes);
      setTrends(trendsRes);
    } catch (err) {
      setError('Failed to load analytics/report data.');
    } finally {
      setLoading(false);
    }
  }

  // Helper to get full date/month range
  function getFullDateRange(timeFrame, customStart, customEnd) {
    let start, end;
    if (timeFrame === 'custom' && customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
    } else {
      end = new Date();
      if (timeFrame === 'yearly') {
        start = addDays(end, -365);
      } else {
        start = addDays(end, -30);
      }
    }
    return { start, end };
  }

  // Helper to fill trends with zeros for missing days/months
  function fillTrends(trends, timeFrame, customStart, customEnd) {
    const { start, end } = getFullDateRange(timeFrame, customStart, customEnd);
    let allKeys = [];
    if (timeFrame === 'yearly') {
      allKeys = eachMonthOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM'));
    } else {
      allKeys = eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'));
    }
    const trendsMap = Object.fromEntries(trends.map((d) => [d.day, d.count]));
    return allKeys.map((day) => ({
      day,
      count: trendsMap[day] || 0,
    }));
  }

  // Fetch analytics data from backend with filters
  useEffect(() => {
    const fetchFilteredAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        let start_date, end_date;
        if (selectedYear !== 'all' && selectedMonth !== 'all' && selectedDay !== 'all') {
          // Single day
          start_date = end_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        } else if (selectedYear !== 'all' && selectedMonth !== 'all') {
          // Whole month
          start_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
          // Calculate last day of month
          const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
          end_date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        } else if (selectedYear !== 'all') {
          // Whole year
          start_date = `${selectedYear}-01-01`;
          end_date = `${selectedYear}-12-31`;
        } else if (earliestDate) {
          // No filter: use earliest anomaly date from endpoint
          start_date = format(parseISO(earliestDate), 'yyyy-MM-dd');
          end_date = format(nowDate, 'yyyy-MM-dd');
        } else {
          // If earliestDate is not yet loaded, do not fetch
          setLoading(false);
          return;
        }
        const params = [];
        if (start_date && end_date) {
          params.push(`start_date=${start_date}`);
          params.push(`end_date=${end_date}`);
        }
        const url = `/anomalies/report/analytics/?${params.join('&')}`;
        console.log ("report/analytics/", url);
        console.log('Fetching analytics data from:', url);
        const data = await apiService.get(url);
        console.log('Analytics data received:', data);
        console.log('Analytics data type:', typeof data);
        console.log('Analytics data keys:', Object.keys(data || {}));
        console.log('Analytics severity_data:', data?.severity_data);
        console.log('Analytics status_data:', data?.status_data);
        console.log('Analytics unit_data:', data?.unit_data);
        console.log('Analytics trend_data:', data?.trend_data);
        console.log('Setting analytics data in state:', data);
        setAnalyticsData(data);
      } catch (err) {
        console.error('Error fetching analytics data:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };
    fetchFilteredAnalytics();
  }, [selectedYear, selectedMonth, selectedDay, earliestDate, nowDate]);

  // Fetch yearly trend data
  useEffect(() => {
    const fetchYearlyTrendData = async () => {
      try {
        // Determine the year to use
        let year;
        if (selectedYear !== 'all') {
          year = parseInt(selectedYear);
        } else {
          year = new Date().getFullYear();
        }
        
        // Use the trends endpoint with year filter
        const start_date = `${year}-01-01`;
        const end_date = `${year}-12-31`;
        
        console.log('Fetching trends for year:', year);
        const response = await apiService.get(`/anomalies/report/trends/?start=${start_date}&end=${end_date}&period=yearly`);
        console.log('Trends response:', response);
        
        if (response && Array.isArray(response)) {
          // Convert the trends data to monthly format for the chart
          const monthlyData = [];
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          
          // Group by month
          const monthCounts = {};
          response.forEach(item => {
            if (item.day) {
              const month = item.day.substring(5, 7); // Extract MM from YYYY-MM-DD
              const monthIndex = parseInt(month) - 1;
              const monthName = monthNames[monthIndex];
              monthCounts[monthName] = (monthCounts[monthName] || 0) + item.count;
            }
          });
          
          // Create monthly data array
          monthNames.forEach(monthName => {
            monthlyData.push({
              month: monthName,
              value: monthCounts[monthName] || 0
            });
          });
          
          setYearlyTrendData(monthlyData);
        } else {
          setYearlyTrendData([]);
        }
      } catch (err) {
        console.error('Failed to load yearly trend data:', err);
        setYearlyTrendData([]);
      }
    };
    
    fetchYearlyTrendData();
  }, [selectedYear]);

  // Filter other data
  const filteredByStatus = useMemo(() => filterDataByDate(byStatus), [byStatus, selectedMonth, selectedDay, selectedYear]);
  const filteredByCriticality = useMemo(() => filterDataByDate(byCriticality), [byCriticality, selectedMonth, selectedDay, selectedYear]);
  const filteredBySection = useMemo(() => filterDataByDate(bySection), [bySection, selectedMonth, selectedDay, selectedYear]);

  // Use filled trends for the chart, but with the correct date range
  const { start_date: resolvedStart, end_date: resolvedEnd } = getResolvedOverTimeRange(selectedYear, selectedMonth, selectedDay, earliestDate, nowDate);
  const filledTrends = useMemo(() => {
    if (!resolvedStart || !resolvedEnd || !trends || !Array.isArray(trends)) return [];
    const start = parseISO(resolvedStart);
    const end = parseISO(resolvedEnd);
    // Decide granularity: if range is <= 31 days, show by day, else by month
    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
    let allKeys = [];
    if (daysDiff <= 31) {
      allKeys = eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'));
      // Map trends data by day
      const trendsMap = {};
      for (const d of trends) {
        if (d.day) trendsMap[d.day] = d.count;
        if (d.month) trendsMap[d.month] = d.value;
      }
      return allKeys.map((key) => ({
        day: key,
        count: trendsMap[key] || 0,
      }));
    } else {
      allKeys = eachMonthOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM'));
      // Group daily data by month and sum counts
      const monthSums = {};
      for (const d of trends) {
        if (d.day) {
          const monthKey = d.day.slice(0, 7); // 'YYYY-MM'
          monthSums[monthKey] = (monthSums[monthKey] || 0) + d.count;
        }
        if (d.month) {
          monthSums[d.month] = (monthSums[d.month] || 0) + d.value;
        }
      }
      return allKeys.map((key) => ({
        day: key,
        count: monthSums[key] || 0,
      }));
    }
  }, [resolvedStart, resolvedEnd, trends]);

  if (loading) {
    return <div className="p-8">Loading analytics & report...</div>;
  }
  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }
  if (!summary || typeof summary !== 'object' || summary.total_anomalies === undefined) {
    return <div className="p-8 text-red-600">Failed to load report data (malformed response).</div>;
  }

  // Pie chart legend helper
  const PieChartLegend = ({ data, colors }) => (
    <div className="flex flex-col space-y-2 text-sm">
      {data.map((entry, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color || colors[index % colors.length] }} 
            />
            <span className="text-gray-700">{entry.name || entry.condition || entry.status || entry.section || entry.unit}</span>
          </div>
          <span className="font-medium text-gray-900">{entry.value || entry.count}</span>
        </div>
      ))}
    </div>
  );

  // Custom tooltips for analytics charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">{`${label || 'Value'}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  const PieChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">{`${data.name || data.status}: ${data.value || data.count}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics & Reports</h1>

      {/* Date Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filter by Date</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Year Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Years</option>
              {(availableYears.length > 0 ? availableYears : Array.from({length: new Date().getFullYear() - 1999}, (_, i) => 2000 + i)).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Months</option>
              {(availableMonths.length > 0 ? availableMonths : Array.from({length: 12}, (_, i) => i + 1)).map((month) => (
                <option key={month} value={month}>{monthNames[month - 1]}</option>
              ))}
            </select>
          </div>

          {/* Day Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Day</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Days</option>
              {(availableDays.length > 0 ? availableDays : Array.from({length: 31}, (_, i) => i + 1)).map((day) => (
                <option key={day} value={day}>Day {day}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedYear !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {selectedYear}
              <button
                onClick={() => setSelectedYear('all')}
                className="ml-2 text-purple-600 hover:text-purple-800"
              >
                ×
              </button>
            </span>
          )}
          {selectedMonth !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <Calendar className="w-3 h-3 mr-1" />
              {monthNames[parseInt(selectedMonth) - 1]}
              <button
                onClick={() => setSelectedMonth('all')}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          )}
          {selectedDay !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Day {selectedDay}
              <button
                onClick={() => setSelectedDay('all')}
                className="ml-2 text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Resolved Over Time Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Resolved Over Time</h2>
        {console.log('Filled trends data:', filledTrends)}
        {filledTrends && filledTrends.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={filledTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="day"
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
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b2f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#3b82f6' }}
            />
          </LineChart>
        </ResponsiveContainer>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No resolved trends data available
          </div>
        )}
      </div>

      {/* AnalyticsVisualization.js charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anomalies by Criticality */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Anomalies by Criticality
            {filteredByCriticality.length !== byCriticality.length && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({filteredByCriticality.length} of {byCriticality.length} items)
              </span>
            )}
          </h2>
          {/* {console.log('ByCriticality data:', filteredByCriticality)}
          {console.log('ByCriticality data type:', typeof filteredByCriticality)}
          {console.log('ByCriticality data length:', filteredByCriticality?.length)}
          {console.log('Full byCriticality data:', byCriticality)} */}
          {filteredByCriticality && filteredByCriticality.length > 0 ? (
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                      data={filteredByCriticality}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                      dataKey="count"
                  >
                      {filteredByCriticality.map((entry, index) => (
                      <Cell
                          key={`cell-crit-${index}`}
                          fill={CRITICALITY_COLORS[index % CRITICALITY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="ml-6">
                <PieChartLegend data={filteredByCriticality} colors={CRITICALITY_COLORS} />
            </div>
          </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No criticality data available
            </div>
          )}
        </div>

        {/* Anomalies by Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Anomalies by Status
            {filteredByStatus.length !== byStatus.length && (
              
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({filteredByStatus.length} of {byStatus.length} items)
              </span>
            )}
          </h2>
          {console.log('ByStatus data in render:', filteredByStatus)}
          {console.log('ByStatus data type:', typeof filteredByStatus)}
          {console.log('ByStatus data length:', filteredByStatus?.length)}
          {console.log('Full byStatus data:', byStatus)}
          {filteredByStatus && filteredByStatus.length > 0 ? (
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                      data={filteredByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                      dataKey="count"
                  >
                      {filteredByStatus.map((entry, index) => (
                      <Cell
                        key={`cell-status-${index}`}
                          fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="ml-6">
                <PieChartLegend data={filteredByStatus} colors={STATUS_COLORS} />
            </div>
          </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No status data available
            </div>
          )}
        </div>

        {/* Anomaly Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Anomaly Trend Year {selectedYear !== 'all' ? selectedYear : new Date().getFullYear()}
            {yearlyTrendData.length !== yearlyTrendData.length && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({yearlyTrendData.length} of {yearlyTrendData.length} months)
              </span>
            )}
          </h2>
          {console.log('Yearly trend data:', yearlyTrendData)}
          {yearlyTrendData && yearlyTrendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={yearlyTrendData}>
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
                <Tooltip 
                  formatter={(value, name) => [value, 'Anomalies']}
                  labelFormatter={(label) => `${label} ${selectedYear !== 'all' ? selectedYear : new Date().getFullYear()}`}
                />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#3b82f6' }}
                  name="Anomalies"
              />
            </LineChart>
          </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No trend data available
            </div>
          )}
        </div>

        {/* Anomalies by Unit */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Anomalies by Unit
            {analyticsData.unit_data.length !== analyticsData.unit_data.length && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({analyticsData.unit_data.length} of {analyticsData.unit_data.length} items)
              </span>
            )}
          </h2>
          {console.log('Unit data:', analyticsData.unit_data)}
          {analyticsData.unit_data && analyticsData.unit_data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analyticsData.unit_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                domain={[0, 'dataMax + 1']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No unit data available
            </div>
          )}
        </div>
      </div>

      {/* By Section Table */}
      <div className="bg-white rounded shadow p-6 overflow-x-auto">
        <div className="font-semibold mb-2">
          Anomalies by Section
          {filteredBySection.length !== bySection.length && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({filteredBySection.length} of {bySection.length} sections)
            </span>
          )}
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table className="min-w-full text-sm">
            <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
              <tr>
                <th className="text-left p-2">Section</th>
                <th className="text-left p-2">Total</th>
                <th className="text-left p-2">Resolved</th>
                <th className="text-left p-2" title="Average days between detection and resolution for resolved anomalies in this section">
                  Avg. Resolution Time (days) ⓘ
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBySection.slice(0, 10).map((row) => (
                <tr key={row.section}>
                  <td className="p-2">{row.section}</td>
                  <td className="p-2">{row.total}</td>
                  <td className="p-2">{row.resolved}</td>
                  <td className="p-2">{row.avg_resolution_time}</td>
                </tr>
              ))}
              {filteredBySection.length > 10 &&
                filteredBySection.slice(10).map((row) => (
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
    </div>
  );
}