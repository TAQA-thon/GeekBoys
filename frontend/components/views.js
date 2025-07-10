import React, { useState, useEffect } from "react";
import apiService from "../services/api";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Edit3,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Helper function to get badge styles based on value
const getBadgeClass = (type, value) => {
  if (type === "status") {
    switch (value.toLowerCase()) {
      case "pending":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800";
      case "open":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800";
      case "in progress":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800";
      case "resolved":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800";
      default:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800";
    }
  }

  if (type === "criticality") {
    switch (value.toLowerCase()) {
      case "very low":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800";
      case "low":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-900";
      case "medium low":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800";
      case "medium high":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-yellow-200 text-yellow-900";
      case "high":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800";
      case "critical":
        return "px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800";
      default:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800";
    }
  }

  return "px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800";
};

export default function AnomalyPage() {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState("");
  const [updating, setUpdating] = useState(false);
  const [statusUpdateModal, setStatusUpdateModal] = useState(null);
  const [rexInput, setRexInput] = useState("");

  // Approval modal state
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [editedAnomaly, setEditedAnomaly] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Auto-clear success message after a few seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Fetch anomalies when pagination parameters change
  useEffect(() => {
    fetchAnomalies();
  }, [currentPage, itemsPerPage, filterStatus]);

  // Reset to page 1 when filter status changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  // We don't need to slice the anomalies anymore as they come paginated from the backend
  // This is kept for compatibility with existing code that calls getVisibleAnomalies()
  const getVisibleAnomalies = () => {
    return anomalies;
  };

  // Pagination function to navigate to specific page
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // We'll fetch new data when currentPage changes via useEffect
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
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Show first page + ellipsis + last 5 pages
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show first page + ellipsis + current-1, current, current+1 + ellipsis + last page
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // Handle page input change
  const handlePageInputChange = (e) => {
    setPageInput(e.target.value);
  };

  // Handle page input submission
  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (page && page >= 1 && page <= totalPages) {
      goToPage(page);
      setPageInput("");
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (e) => {
    const newValue = parseInt(e.target.value);
    setItemsPerPage(newValue);
    setCurrentPage(1); // Reset to first chunk when changing items per page
  };

  // Fetch anomalies from backend with pagination
  useEffect(() => {
    fetchAnomalies();
  }, [currentPage, filterStatus]);

  // Reset to page 1 when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  // Section-specific loading state for better UX
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);

  const fetchAnomalies = async () => {
    try {
      // Use section-specific loading state instead of page-wide loading
      setAnomaliesLoading(true);
      let filters = {};

      // Apply status filter based on current tab
      if (filterStatus === "pending") {
        // For pending tab, only show unapproved anomalies
        filters.approved = false;
      } else if (filterStatus !== "All") {
        // For specific status tabs, show only approved anomalies with that exact status
        filters.status = filterStatus;
        filters.approved = true;
      }

      // First, get the total count with the same filters
      const countResponse = await apiService.getAnomalyCount(filters);
      const totalItems = countResponse.count || 0;

      // Calculate total pages based on count
      const calculatedTotalPages = Math.ceil(totalItems / itemsPerPage);
      setTotalCount(totalItems);
      setTotalPages(calculatedTotalPages);

      // If current page is beyond the new total pages, reset to page 1
      if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
        setCurrentPage(1);
      }

      // Then get the current page of anomalies
      const response = await apiService.getAnomaliesPaginated(
        currentPage > calculatedTotalPages ? 1 : currentPage,
        itemsPerPage,
        filters,
      );

      // Update state with filtered results
      setAnomalies(response.anomalies || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching anomalies:", err);
      setError("Failed to load anomalies");
      setAnomalies([]);
    } finally {
      // Only update the anomalies section loading state
      setAnomaliesLoading(false);
      // Keep the main loading state false after initial load
      setLoading(false);
    }
  };

  // Get unique statuses for filter
  const uniqueStatuses = ["All", "pending", "open", "in_progress", "resolved"];

  // Available status options for dropdown
  const statusOptions = [
    {
      value: "pending",
      label: "Pending",
      color: "bg-orange-100 text-orange-800",
    },
    { value: "open", label: "Open", color: "bg-yellow-100 text-yellow-800" },
    {
      value: "in_progress",
      label: "In Progress",
      color: "bg-blue-100 text-blue-800",
    },
    {
      value: "resolved",
      label: "Resolved",
      color: "bg-green-100 text-green-800",
    },
  ];

  // Get available status options for a specific anomaly
  const getAvailableStatusOptions = (currentStatus) => {
    if (currentStatus === "resolved") {
      // Resolved anomalies cannot be changed
      return statusOptions.filter((option) => option.value === "resolved");
    }
    if (currentStatus === "pending") {
      // Pending anomalies cannot be changed - they must be approved first
      return statusOptions.filter((option) => option.value === "pending");
    }
    return statusOptions;
  };

  // Handle status change from dropdown
  const handleStatusChange = async (anomaly, newStatus) => {
    if (newStatus === "resolved") {
      setStatusUpdateModal({ anomaly, newStatus });
      setRexInput("");
    } else {
      await updateAnomalyStatus(anomaly._id, newStatus);
    }
  };

  // Update anomaly status
  const updateAnomalyStatus = async (anomalyId, newStatus, rex = null) => {
    try {
      setUpdating(true);
      await apiService.updateAnomalyStatus(anomalyId, newStatus, rex);
      await fetchAnomalies(); // Refresh the list
      setStatusUpdateModal(null);
      setRexInput("");
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status: " + (err.message || "Unknown error"));
    } finally {
      setUpdating(false);
    }
  };

  // Handle REX submission for resolved status
  const handleRexSubmit = async () => {
    if (!rexInput.trim()) {
      alert("REX (solution) is required when marking as resolved");
      return;
    }
    await updateAnomalyStatus(
      statusUpdateModal.anomaly._id,
      statusUpdateModal.newStatus,
      rexInput.trim(),
    );
  };

  // Get criticality display value using correct field names
  const getCriticalityDisplay = (anomaly) => {
    // Use 'Criticité' field first, then fallback to 'criticality'
    const criticityValue = anomaly["Criticité"] || anomaly.criticality;
    if (criticityValue) {
      const criticalityMap = {
        1: "Very Low",
        2: "Low",
        3: "Medium Low",
        4: "Medium High",
        5: "High",
        6: "Critical",
        7: "Critical",
        8: "Critical",
        9: "Critical",
        10: "Critical",
      };
      return criticalityMap[criticityValue] || `Level ${criticityValue}`;
    }
    return "Unknown";
  };

  // Get equipment display
  const getEquipmentDisplay = (anomaly) => {
    return (
      anomaly.Num_equipement ||
      anomaly.equipment_id ||
      anomaly["Description de l'équipement"] ||
      "N/A"
    );
  };

  // Get description display
  const getDescriptionDisplay = (anomaly) => {
    return anomaly.Description || anomaly.description || "No description";
  };

  // Get section display
  const getSectionDisplay = (anomaly) => {
    return anomaly["Section propriétaire"] || anomaly.section || "N/A";
  };

  // Get status display with proper formatting
  const getStatusDisplay = (status) => {
    const statusMap = {
      pending: "Pending",
      open: "Open",
      in_progress: "In Progress",
      resolved: "Resolved",
    };
    return statusMap[status] || status;
  };

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, itemsPerPage]);

  // Handle anomaly approval - open modal for editing
  const handleApproveAnomaly = (anomaly) => {
    // Clear any previous messages
    setError(null);
    setSuccessMessage(null);

    // Store the original status to use in validation checks
    const originalStatus = anomaly.status || "pending";

    setEditedAnomaly({
      ...anomaly,
      title: getDescriptionDisplay(anomaly),
      unit: getEquipmentDisplay(anomaly),
      severity: getCriticalityDisplay(anomaly),
      status: "open", // Set initial status to "open" for approval
      originalStatus: originalStatus, // Store original status for reference
      priority: anomaly.priority || "Medium",
      time_span: anomaly.time_span || 0,
      unit_outage: anomaly.unit_outage || false,
    });
    setIsApprovalModalOpen(true);
  };

  // Handle edit change in approval modal
  const handleEditChange = (field, value) => {
    setEditedAnomaly((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Cancel approval
  const cancelApproval = () => {
    setIsApprovalModalOpen(false);
    setEditedAnomaly(null);
  };

  // Approve anomaly with edited data
  const approveAnomaly = async () => {
    try {
      setModalLoading(true);
      setError(null); // Clear any previous errors

      // Make sure the anomaly status is not directly set to resolved from pending
      if (
        editedAnomaly.status === "resolved" &&
        editedAnomaly.originalStatus === "pending"
      ) {
        setError(
          "Pending anomalies cannot directly change to resolved status. Please change to open first."
        );
        setModalLoading(false);
        return;
      }

      // First, update the anomaly with the edited data (excluding status)
      const updateData = {
        Description: editedAnomaly.title,
        Num_equipement: editedAnomaly.unit,
        "Fiabilité Intégrité": editedAnomaly["Fiabilité Intégrité"],
        "Disponibilté": editedAnomaly["Disponibilté"],
        "Process Safety": editedAnomaly["Process Safety"],
        status: editedAnomaly.status,
        time_span: editedAnomaly.time_span,
        unit_outage: editedAnomaly.unit_outage,
        
      };

      // First update the anomaly data (without status)
      const updateResponse = await apiService.editAnomaly(
        editedAnomaly._id,
        updateData
      );

      // Check if update was successful
      if (!updateResponse || updateResponse.error) {
        throw new Error("Failed to update anomaly data");
      }

      // Then approve the anomaly with a separate call
      const approveResponse = await apiService.approveAnomaly(editedAnomaly._id);

      // Different APIs might return success in different formats
      // Check for common success patterns
      const isSuccess =
        (approveResponse && approveResponse.success) ||
        (approveResponse && approveResponse.approved) ||
        (!approveResponse.error && approveResponse.id) ||
        (!approveResponse.error && approveResponse._id);

      if (isSuccess) {
        // Now update the status separately to ensure it's set correctly
        await apiService.updateAnomalyStatus(editedAnomaly._id, editedAnomaly.status);

        // Success - refresh the list and close modal
        await fetchAnomalies();
        setIsApprovalModalOpen(false);
        setEditedAnomaly(null);

        // Set success message that could be shown in the UI
        setSuccessMessage("Anomaly approved successfully");
      } else {
        // Handle API success but business logic error
        setError(
          "Anomaly update successful but approval failed. Please check backend logs."
        );
      }
    } catch (error) {
      setError("Failed to approve anomaly: " + (error.message || "Please try again"));
    } finally {
      setModalLoading(false);
    }
  };

  // Helper function to convert criticality display back to level
  const getCriticalityLevel = (display) => {
    const levelMap = {
      "Very Low": 1,
      Low: 2,
      "Medium Low": 3,
      "Medium High": 4,
      High: 5,
      Critical: 6,
    };
    return levelMap[display] || 3;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading anomalies...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchAnomalies}
            className="ml-4 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Anomaly Review</h1>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-700 hover:text-green-900"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>
      )}

      {/* Navbar-style filter */}
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-300">
        {uniqueStatuses.map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 font-semibold rounded-t-md focus:outline-none transition ${
              filterStatus === status
                ? "border-b-4 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-blue-600"
            }`}
          >
            {getStatusDisplay(status)}
          </button>
        ))}
      </nav>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Equipment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Section
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Criticality
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {anomaliesLoading ? (
              <tr>
                <td colSpan="6" className="px-6 py-4">
                  <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-gray-500">Loading anomalies...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="6"
                  className="px-6 py-4 text-center text-sm text-red-500"
                >
                  {error}
                </td>
              </tr>
            ) : getVisibleAnomalies().length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  No anomalies found.
                </td>
              </tr>
            ) : (
              getVisibleAnomalies().map((anomaly) => {
                const currentStatus =
                  anomaly.status ||
                  (anomaly.Approved === false ? "pending" : "open");
                const criticalityDisplay = getCriticalityDisplay(anomaly);
                const availableOptions =
                  getAvailableStatusOptions(currentStatus);

                return (
                  <tr key={anomaly._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={getDescriptionDisplay(anomaly)}>
                      {getDescriptionDisplay(anomaly)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getEquipmentDisplay(anomaly)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getSectionDisplay(anomaly)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={getBadgeClass(
                          "criticality",
                          criticalityDisplay,
                        )}
                      >
                        {criticalityDisplay}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={currentStatus}
                        onChange={(e) =>
                          handleStatusChange(anomaly, e.target.value)
                        }
                        disabled={
                          updating ||
                          currentStatus === "resolved" ||
                          currentStatus === "pending"
                        }
                        className={`text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                          currentStatus === "resolved" ? "bg-green-50" : ""
                        } ${
                          currentStatus === "pending" ? "bg-yellow-50" : ""
                        }`}
                      >
                        {availableOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2 flex-wrap">
                        <button
                          onClick={() => setSelectedAnomaly(anomaly)}
                          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition text-sm"
                        >
                          <FileText className="w-4 h-4 inline mr-1" />
                          View
                        </button>

                        {currentStatus === "pending" && (
                          <button
                            onClick={() => handleApproveAnomaly(anomaly)}
                            disabled={updating}
                            className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="w-4 h-4 inline mr-1" />
                            Approve
                          </button>
                        )}

                        {currentStatus === "resolved" &&
                          (anomaly.Solution || anomaly.rex) && (
                            <button
                              onClick={() => setSelectedAnomaly(anomaly)}
                              className="bg-gray-600 text-white px-3 py-1 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition text-sm"
                            >
                              <CheckCircle className="w-4 h-4 inline mr-1" />
                              REX
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}{" "}
              total anomalies
            </div>
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
              {/* Items per page selector */}
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Items per page:</label>
                <select
                  value={itemsPerPage}
                  onChange={handleItemsPerPageChange}
                  className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Previous page button */}
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

                {/* Page numbers with ellipsis */}
                {getPageNumbers().map((page, index) => (
                  <button
                    key={index}
                    onClick={() =>
                      typeof page === "number" ? goToPage(page) : null
                    }
                    disabled={page === "..."}
                    className={`px-3 py-1 rounded-lg border text-sm transition-colors duration-200 ${
                      page === "..."
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : currentPage === page
                        ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 shadow-sm"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                {/* Next page button */}
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

                {/* Direct page input */}
                <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                  <span className="text-sm text-gray-600">Go to:</span>
                  <form
                    onSubmit={handlePageInputSubmit}
                    className="flex items-center space-x-1"
                  >
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
        </div>
      )}

      {/* Summary information */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex items-center">
          <div className="text-sm text-gray-700">
            Total: <span className="font-medium">{totalCount}</span> anomalies
          </div>
        </div>
      </div>

      {anomalies.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No anomalies found for the selected filter.
        </div>
      )}

      {/* Modal for anomaly details */}
      {selectedAnomaly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {getDescriptionDisplay(selectedAnomaly)}
              </h2>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-700">
                    Equipment:
                  </span>
                  <p className="text-gray-900">
                    {getEquipmentDisplay(selectedAnomaly)}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">System:</span>
                  <p className="text-gray-900">
                    {selectedAnomaly.Systeme ||
                      selectedAnomaly.system_id ||
                      "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Section:</span>
                  <p className="text-gray-900">
                    {getSectionDisplay(selectedAnomaly)}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Unit:</span>
                  <p className="text-gray-900">
                    {selectedAnomaly.unit || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">
                    Detection Date:
                  </span>
                  <p className="text-gray-900">
                    {selectedAnomaly["Date de détéction de l'anomalie"] ||
                      selectedAnomaly.created_at ||
                      "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">
                    Criticality:
                  </span>
                  <span
                    className={`ml-2 ${getBadgeClass(
                      "criticality",
                      getCriticalityDisplay(selectedAnomaly)
                    )}`}
                  >
                    {getCriticalityDisplay(selectedAnomaly)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Status:</span>
                  <span
                    className={`ml-2 ${getBadgeClass(
                      "status",
                      getStatusDisplay(selectedAnomaly.status)
                    )}`}
                  >
                    {getStatusDisplay(selectedAnomaly.status)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">
                    Date Detected:
                  </span>
                  <p className="text-gray-900">
                    {selectedAnomaly.date_detected
                      ? new Date(selectedAnomaly.date_detected).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              {selectedAnomaly.condition && (
                <div>
                  <span className="font-semibold text-gray-700">
                    Condition:
                  </span>
                  <div className="mt-2 p-4 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-800">
                      {selectedAnomaly.condition}
                    </p>
                  </div>
                </div>
              )}

              {(selectedAnomaly.Solution || selectedAnomaly.rex) && (
                <div>
                  <span className="font-semibold text-gray-700">
                    REX (Solution):
                  </span>
                  <div className="mt-2 p-4 bg-green-50 rounded-md border border-green-200">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800">
                      {selectedAnomaly.Solution || selectedAnomaly.rex}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REX Input Modal for resolved status */}
      {statusUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Mark as Resolved
              </h3>
              <button
                onClick={() => setStatusUpdateModal(null)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Please provide the REX (solution) for this anomaly:
              </p>

              <textarea
                value={rexInput}
                onChange={(e) => setRexInput(e.target.value)}
                placeholder="Enter the solution/resolution details..."
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={4}
                required
              />

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setStatusUpdateModal(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRexSubmit}
                  disabled={updating || !rexInput.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? "Updating..." : "Mark as Resolved"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal with editable fields */}
      {isApprovalModalOpen && editedAnomaly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 overflow-y-auto max-h-[90vh]">
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
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
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

            {error && (
              <div className="mb-4 text-red-600 font-semibold">{error}</div>
            )}

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
    </div>
  );
}