import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import apiService from '../services/api';
import { 
  transformAnomalyFromBackend, 
  transformAnomalyToBackend,
  transformStatisticsFromBackend,
  calculateResolutionRate,
  getCriticalIssuesCount,
  formatDate
} from '../utils/dataTransformers';

const AnomalyDashboard = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [statistics, setStatistics] = useState({
    total_anomalies: 0,
    critical_anomalies: 0,
    high_anomalies: 0,
    medium_anomalies: 0,
    low_anomalies: 0,
    approved_anomalies: 0,
    scheduled_anomalies: 0,
    unit_count: 0,
    unit_outages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [editedAnomaly, setEditedAnomaly] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [pageInput, setPageInput] = useState('');
  
  // Solution modal state
  const [isSolutionModalOpen, setIsSolutionModalOpen] = useState(false);
  const [solutionAnomaly, setSolutionAnomaly] = useState(null);
  const [solutionText, setSolutionText] = useState('');
  const [solutionLoading, setSolutionLoading] = useState(false);

  // Load data from backend
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load anomalies (only unapproved) - request all for complete data
      const anomaliesResponse = await apiService.getAnomalies({ get_all: 'true' });
      const transformedAnomalies = anomaliesResponse.anomalies?.map(transformAnomalyFromBackend) || [];
      setAnomalies(transformedAnomalies);

      // Load statistics for unapproved anomalies only
      const statsResponse = await apiService.getUnapprovedAnomalyStatistics();
      const transformedStats = transformStatisticsFromBackend(statsResponse);
      setStatistics(transformedStats);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (anomalyId, newStatus) => {
    try {
      const anomaly = anomalies.find(a => a.id === anomalyId);
      if (!anomaly) return;

      // If status is being changed to "Resolved", prompt for solution
      if (newStatus === "Resolved") {
        setSolutionAnomaly(anomaly);
        setSolutionText('');
        setIsSolutionModalOpen(true);
        return;
      }

      const updateData = transformAnomalyToBackend({
        ...anomaly,
        status: newStatus
      });

      await apiService.editAnomaly(anomalyId, updateData);
      
      // Update local state
      setAnomalies(prev => 
        prev.map(anomaly => 
          anomaly.id === anomalyId 
            ? { ...anomaly, status: newStatus }
            : anomaly
        )
      );

      // Refresh statistics
      await loadData();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + err.message);
    }
  };

  const handlePriorityChange = async (anomalyId, newPriority) => {
    try {
      const anomaly = anomalies.find(a => a.id === anomalyId);
      if (!anomaly) return;

      const updateData = transformAnomalyToBackend({
        ...anomaly,
        priority: newPriority
      });

      await apiService.editAnomaly(anomalyId, updateData);
      
      // Update local state
      setAnomalies(prev => 
        prev.map(anomaly => 
          anomaly.id === anomalyId 
            ? { ...anomaly, priority: newPriority }
            : anomaly
        )
      );
    } catch (err) {
      console.error('Error updating priority:', err);
      alert('Failed to update priority: ' + err.message);
    }
  };

  const getStatusOptions = (currentStatus) => {
    if (currentStatus === "Resolved") {
      return ["Resolved"];
    }
    return ["Open", "In Progress", "Resolved"];
  };

  const getPriorityOptions = (currentStatus) => {
    if (currentStatus === "Resolved") {
      return [];
    }
    return ["High", "Medium", "Low"];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Open":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "In Progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Resolved":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSeverityColor = (severity) => {
    // Convert to string or number as needed
    const sev = String(severity);
  
    if (["10", "11", "12", "13", "14", "15"].includes(sev)) {
      return "bg-red-500 text-white";
    } else if (["9", "8", "7"].includes(sev)) {
      return "bg-orange-500 text-white";
    } else if (["6", "5", "4"].includes(sev)) {
      return "bg-yellow-500 text-white";
    } else if (["3", "2"].includes(sev)) {
      return "bg-green-500 text-white";
    } else {
      return "bg-gray-500 text-white";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-800 border-red-200";
      case "Medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Sort anomalies: Open and In Progress first, then Resolved
  const sortedAnomalies = [...anomalies].sort((a, b) => {
    if (a.status === "Resolved" && b.status !== "Resolved") return 1;
    if (a.status !== "Resolved" && b.status === "Resolved") return -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedAnomalies.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAnomalies = sortedAnomalies.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Generate page numbers with ellipsis for large numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 4) {
        // Show first 5 pages + ellipsis + last page
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Show first page + ellipsis + last 5 pages
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show first page + ellipsis + current-1, current, current+1 + ellipsis + last page
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const handlePageInputChange = (e) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (page && page >= 1 && page <= totalPages) {
      goToPage(page);
      setPageInput('');
    }
  };

  // Modal handlers
  const openApprovalModal = (anomaly) => {
    setSelectedAnomaly(anomaly);
    setEditedAnomaly({ ...anomaly }); // copy for editing
    setIsModalOpen(true);
  };

  const approveAnomaly = async () => {
    if (!editedAnomaly) return;

    try {
      setModalLoading(true);

      // Transform the edited anomaly to backend format
      const updateData = transformAnomalyToBackend({
        ...editedAnomaly,
        approved: true
      });

      // Update the anomaly
      await apiService.editAnomaly(editedAnomaly.id, updateData);

      // Update local state
      setAnomalies(prev =>
        prev.map(a =>
          a.id === editedAnomaly.id ? { ...editedAnomaly, approved: true } : a
        )
      );

      setIsModalOpen(false);
      setSelectedAnomaly(null);
      setEditedAnomaly(null);

      // Refresh data to get updated statistics
      await loadData();
    } catch (err) {
      console.error('Error approving anomaly:', err);
      alert('Failed to approve anomaly: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const cancelApproval = () => {
    setIsModalOpen(false);
    setSelectedAnomaly(null);
    setEditedAnomaly(null);
  };

  // Handle input changes in modal
  const handleEditChange = (field, value) => {
    setEditedAnomaly(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Solution modal handlers
  const submitSolution = async () => {
    if (!solutionAnomaly || !solutionText.trim()) {
      alert('Please enter a solution description');
      return;
    }

    try {
      setSolutionLoading(true);

      const updateData = transformAnomalyToBackend({
        ...solutionAnomaly,
        status: 'Resolved',
        Solution: solutionText.trim()
      });

      await apiService.editAnomaly(solutionAnomaly.id, updateData);
      
      // Update local state
      setAnomalies(prev => 
        prev.map(anomaly => 
          anomaly.id === solutionAnomaly.id 
            ? { ...anomaly, status: 'Resolved', Solution: solutionText.trim() }
            : anomaly
        )
      );

      // Close modal and reset state
      setIsSolutionModalOpen(false);
      setSolutionAnomaly(null);
      setSolutionText('');
      
      // Refresh statistics
      await loadData();
    } catch (err) {
      console.error('Error submitting solution:', err);
      alert('Failed to submit solution: ' + err.message);
    } finally {
      setSolutionLoading(false);
    }
  };

  const cancelSolution = () => {
    setIsSolutionModalOpen(false);
    setSolutionAnomaly(null);
    setSolutionText('');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <AlertTriangle size={48} className="mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Anomaly Management Dashboard</h1>
            <p className="text-gray-600">Monitor and manage system anomalies and approvals</p>
          </div>
          {/* <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button> */}
        </div>

        {/* Stats Cards - Horizontal Layout */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* All Anomalies */}
            <div className="text-center flex flex-col items-center">
              <AlertCircle size={36} className="text-orange-500 mb-2" />
              <p className="text-sm font-medium text-gray-600 mb-1">All Anomalies</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">{statistics.total_anomalies}</p>
            </div>

            {/* Critical Issues */}
            <div className="text-center flex flex-col items-center">
              <AlertTriangle size={36} className="text-red-500 mb-2" />
              <p className="text-sm font-medium text-gray-600 mb-1">Critical Issues</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">{statistics.critical_anomalies}</p>
            </div>

            {/* High Priority */}
            <div className="text-center flex flex-col items-center">
              <AlertTriangle size={36} className="text-yellow-500 mb-2" />
              <p className="text-sm font-medium text-gray-600 mb-1">High Priority</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">{anomalies.filter(a => a.priority === 'High').length}</p>
            </div>

            {/* Pending Approval */}
            <div className="text-center flex flex-col items-center">
              <Clock size={36} className="text-blue-500 mb-2" />
              <p className="text-sm font-medium text-gray-600 mb-1">Pending Approval</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">{anomalies.length}</p>
            </div>
          </div>
        </div>

        {/* Anomalies Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Anomalies Requiring Approval</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th> */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Outage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Approved
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentAnomalies.map((anomaly) => (
                  <tr key={anomaly.id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px] truncate" title={anomaly.title}>
                        {anomaly.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{anomaly.unit}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(anomaly.criticality)}`}>
                        {anomaly.criticality}
                      </span>
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={anomaly.status}
                        onChange={(e) => handleStatusChange(anomaly.id, e.target.value)}
                        disabled={anomaly.status === "Resolved"}
                        className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border transition-colors duration-200 appearance-none bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                          anomaly.status === "Resolved" 
                            ? "cursor-not-allowed opacity-75" 
                            : "hover:bg-opacity-80"
                        } ${getStatusColor(anomaly.status)}`}
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 0.5rem center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '1.5em 1.5em',
                          paddingRight: '2rem'
                        }}
                      >
                        {getStatusOptions(anomaly.status).map(option => (
                          <option key={option} value={option} className="text-sm">{option}</option>
                        ))}
                      </select>
                    </td> */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {anomaly.unit_outage ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {anomaly.approved ? (
                        <span className="text-green-600 font-semibold">Approved</span>
                      ) : (
                        <button
                          onClick={() => openApprovalModal(anomaly)}
                          className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"

                        >
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                          Approve
                        </button>
                      )}
                    </td>
                   
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(anomaly.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="text-sm text-gray-700">
                  Showing {startIndex + 1} to {Math.min(endIndex, sortedAnomalies.length)} of {sortedAnomalies.length} total anomalies
                </div>
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-lg border transition-colors duration-200 ${
                        currentPage === 1
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
                      }`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    {getPageNumbers().map((page, index) => (
                      <button
                        key={index}
                        onClick={() => typeof page === 'number' ? goToPage(page) : null}
                        disabled={page === '...'}
                        className={`px-3 py-1 rounded-lg border text-sm transition-colors duration-200 ${
                          page === '...'
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : currentPage === page
                            ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 shadow-sm"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-lg border transition-colors duration-200 ${
                        currentPage === totalPages
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
                      }`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Direct page input */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Go to:</span>
                    <form onSubmit={handlePageInputSubmit} className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={pageInput}
                        onChange={handlePageInputChange}
                        min="1"
                        max={totalPages}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Page"
                      />
                      <button
                        type="submit"
                        className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Go
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Modal with editable fields */}
      {isModalOpen && editedAnomaly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Approve Anomaly</h3>
            
            <label className="block mb-2">
              <span className="text-gray-700 font-medium">Title</span>
              <input
                type="text"
                value={editedAnomaly.title}
                disabled
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              />
            </label>

            <label className="block mb-2">
              <span className="text-gray-700 font-medium">Unit</span>
              <input
                type="text"
                value={editedAnomaly.unit}
                disabled
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              />
            </label>

            <label className="block mb-2">
              <span className="text-gray-700 font-medium">Fiabilité Intégrité</span>
              <input
                type="number"
                min="1"
                max="5"
                value={editedAnomaly['Fiabilité Intégrité'] || ''}
                onChange={e => handleEditChange('Fiabilité Intégrité', parseInt(e.target.value) || 0)}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
              />
            </label>

            <label className="block mb-2">
              <span className="text-gray-700 font-medium">Disponibilté</span>
              <input
                type="number"
                min="1"
                max="5"
                value={editedAnomaly['Disponibilté'] || ''}
                onChange={e => handleEditChange('Disponibilté', parseInt(e.target.value) || 0)}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
              />
            </label>

            <label className="block mb-2">
              <span className="text-gray-700 font-medium">Process Safety</span>
              <input
                type="number"
                min="1"
                max="5"
                value={editedAnomaly['Process Safety'] || ''}
                onChange={e => handleEditChange('Process Safety', parseInt(e.target.value) || 0)}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
              />
            </label>

            <label className="block mb-2">
              <span className="text-gray-700 font-medium">Status</span>
              <select
                value={editedAnomaly.status}
                onChange={e => handleEditChange('status', e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </label>

            <label className="block mb-4">
              <span className="text-gray-700 font-medium">Time Span (hours)</span>
              <input
                type="number"
                value={editedAnomaly.time_span || 0}
                onChange={e => handleEditChange('time_span', parseFloat(e.target.value) || 0)}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                min="0"
                step="0.5"
              />
            </label>

            <label className="block mb-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={editedAnomaly.unit_outage || false}
                  onChange={e => handleEditChange('unit_outage', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-gray-700 font-medium">Unit Outage Required</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">Check if this anomaly requires shutting down the whole unit to be fixed</p>
            </label>

            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelApproval}
                disabled={modalLoading}
                className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={approveAnomaly}
                disabled={modalLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {modalLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {modalLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Solution Modal */}
      {isSolutionModalOpen && solutionAnomaly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Submit Solution</h3>
            
            <label className="block mb-2">
              <span className="text-gray-700 font-medium">Solution Description</span>
              <textarea
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                rows="4"
                placeholder="Describe the solution implemented to fix this anomaly. Include details about what was done, tools used, and any important notes."
              ></textarea>
            </label>

            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelSolution}
                disabled={solutionLoading}
                className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitSolution}
                disabled={solutionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {solutionLoading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnomalyDashboard;