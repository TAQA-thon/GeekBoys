import React, { useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const AnomalyDashboard = () => {
  const [anomalies, setAnomalies] = useState([
    {
      id: 1,
      title: "Pressure Drop in Unit A",
      unit: "Production Unit A",
      severity: "Critical",
      priority: "High",
      status: "Open",
      date: "2024-07-01"
    },
    {
      id: 2,
      title: "Temperature Spike in Reactor B",
      unit: "Production Unit B",
      severity: "High",
      priority: "Medium",
      status: "In Progress",
      date: "2024-07-02"
    },
    {
      id: 3,
      title: "Valve Malfunction C3",
      unit: "Utility Unit C",
      severity: "Medium",
      priority: "Low",
      status: "Resolved",
      date: "2024-07-03"
    },
    {
      id: 4,
      title: "Flow Rate Deviation D1",
      unit: "Processing Unit D",
      severity: "Low",
      priority: "High",
      status: "Open",
      date: "2024-07-04"
    },
    {
      id: 5,
      title: "Vibration Alert E2",
      unit: "Compressor Unit E",
      severity: "Medium",
      priority: "Medium",
      status: "In Progress",
      date: "2024-07-05"
    },
    {
      id: 6,
      title: "Cooling System Alert F1",
      unit: "Cooling Unit F",
      severity: "High",
      priority: "High",
      status: "Resolved",
      date: "2024-07-06"
    },
    {
      id: 7,
      title: "Motor Overload G2",
      unit: "Motor Unit G",
      severity: "Critical",
      priority: "High",
      status: "Open",
      date: "2024-07-07"
    },
    {
      id: 8,
      title: "Sensor Malfunction H3",
      unit: "Sensor Unit H",
      severity: "Low",
      priority: "Low",
      status: "Resolved",
      date: "2024-07-08"
    }
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleStatusChange = (anomalyId, newStatus) => {
    setAnomalies(prev => 
      prev.map(anomaly => 
        anomaly.id === anomalyId 
          ? { ...anomaly, status: newStatus }
          : anomaly
      )
    );
  };

  const handlePriorityChange = (anomalyId, newPriority) => {
    setAnomalies(prev => 
      prev.map(anomaly => 
        anomaly.id === anomalyId 
          ? { ...anomaly, priority: newPriority }
          : anomaly
      )
    );
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
        return "bg-red-100 text-red-800 border-red-200";
      case "In Progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Resolved":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "Critical":
        return "bg-red-500 text-white";
      case "High":
        return "bg-orange-500 text-white";
      case "Medium":
        return "bg-yellow-500 text-white";
      case "Low":
        return "bg-green-500 text-white";
      default:
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
    setCurrentPage(page);
  };

  const totalAnomalies = anomalies.length;
  const criticalIssues = anomalies.filter(a => a.severity === "Critical" || a.severity === "High").length;
  const resolved = anomalies.filter(a => a.status === "Resolved").length;
  const resolutionRate = Math.round((resolved / totalAnomalies) * 100);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Anomaly Management</h1>
          <p className="text-gray-600">Monitor and manage system anomalies</p>
        </div>

        {/* Stats Cards - Horizontal Layout */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Total Anomalies */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-3">
                <div className="w-8 h-8 border-2 border-blue-500 rounded"></div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Anomalies</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">{totalAnomalies}</p>
              <p className="text-sm text-gray-500">+2 this week</p>
            </div>

            {/* Critical Issues */}
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-3">
                <div className="w-8 h-8 border-2 border-red-500 rounded"></div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Critical Issues</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">{criticalIssues}</p>
              <p className="text-sm text-gray-500">Needs attention</p>
            </div>

            {/* Resolved */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-3">
                <div className="w-8 h-8 border-2 border-green-500 rounded"></div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Resolved</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">{resolved}</p>
              <p className="text-sm text-gray-500">{resolutionRate}% resolution rate</p>
            </div>

            {/* Avg Resolution */}
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-50 rounded-lg flex items-center justify-center mx-auto mb-3">
                <div className="w-8 h-8 border-2 border-purple-500 rounded"></div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Avg Resolution</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">2.3d</p>
              <p className="text-sm text-gray-500">Improved by 15%</p>
            </div>
          </div>
        </div>

        {/* Recent Anomalies Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Anomalies</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentAnomalies.map((anomaly) => (
                  <tr key={anomaly.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{anomaly.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{anomaly.unit}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(anomaly.severity)}`}>
                        {anomaly.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {anomaly.status !== "Resolved" ? (
                        <select
                          value={anomaly.priority}
                          onChange={(e) => handlePriorityChange(anomaly.id, e.target.value)}
                          className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border cursor-pointer ${getPriorityColor(anomaly.priority)}`}
                        >
                          {getPriorityOptions(anomaly.status).map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getPriorityColor(anomaly.priority)} opacity-50`}>
                          {anomaly.priority}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={anomaly.status}
                        onChange={(e) => handleStatusChange(anomaly.id, e.target.value)}
                        disabled={anomaly.status === "Resolved"}
                        className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(anomaly.status)} ${
                          anomaly.status === "Resolved" 
                            ? "cursor-not-allowed opacity-75" 
                            : "cursor-pointer hover:bg-opacity-80"
                        }`}
                      >
                        {getStatusOptions(anomaly.status).map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {anomaly.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(endIndex, sortedAnomalies.length)} of {sortedAnomalies.length} anomalies
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border ${
                    currentPage === 1
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-1 rounded-lg border text-sm ${
                      currentPage === page
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border ${
                    currentPage === totalPages
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnomalyDashboard;