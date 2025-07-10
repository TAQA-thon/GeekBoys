import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { apiService } from '../services/apiService';

const WorkflowDashboard = () => {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWorkflowData();
  }, []);

  const fetchWorkflowData = async () => {
    try {
      setLoading(true);
      setError(null);

      const unitCount = await apiService.getUnitCount();
      const unitsArray = [];

      for (let i = 1; i <= unitCount; i++) {
        const anomalies = await apiService.getAnomaliesBySystem(i);

        if (anomalies && anomalies.length > 0) {
          const highestCriticality = Math.max(...anomalies.map(a => a.criticality || 2));
          unitsArray.push({
            id: `UNIT ${i}`,
            name: `UNIT ${i}`,
            anomalies: anomalies.map(anomaly => ({
              id: anomaly._id || anomaly.id,
              type: getCriticalityType(anomaly.criticality || 2),
              description: anomaly.description || anomaly.Description || 'No description',
              criticality: anomaly.criticality || 2,
              status: anomaly.status || 'open',
              date: anomaly['Date de détéction de l\'anomalie'] || anomaly.date_detected || anomaly.created_at
            })),
            efficiency: calculateEfficiency(highestCriticality)
          });
        } else {
          unitsArray.push({
            id: `UNIT ${i}`,
            name: `UNIT ${i}`,
            anomalies: [],
            efficiency: 99
          });
        }
      }

      setUnits(unitsArray);

    } catch (err) {
      console.error('Error fetching workflow data:', err);
      setError('Failed to load workflow data');
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateEfficiency = (criticality) => {
    const baseEfficiency = 100 - (criticality * 2);
    return Math.max(85, Math.min(99, baseEfficiency + Math.floor(Math.random() * 10)));
  };

  const getCriticalityType = (criticality) => {
    if (criticality === 1) return 'Too Low';
    if (criticality === 2) return 'Low';
    if (criticality === 3 || criticality === 4) return 'Lower Medium';
    if (criticality === 5 || criticality === 6) return 'Medium High';
    if (criticality >= 7) return 'High';
    return 'Unknown';
  };

  const getHighestCriticality = (anomalies) => {
    if (anomalies.length === 0) return 0;
    return Math.max(...anomalies.map(a => a.criticality));
  };

  const getCriticalityColor = (criticality) => {
    return { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-700' };
    if (criticality === 0) {
      return { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700' };
    } else if (criticality === 1) {
      return { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' };
    } else if (criticality === 2) {
      return { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700' };
    } else if (criticality === 3 || criticality === 4) {
      return { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700' };
    } else if (criticality === 5 || criticality === 6) {
      return { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700' };
    } else if (criticality >= 7) {
      return { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-700' };
    } else {
      return { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' };
    }
  };

  const getSeverityColor = (criticality) => {
    if (criticality === 1) {
      return 'text-gray-600 bg-gray-50';
    } else if (criticality === 2) {
      return 'text-green-600 bg-green-50';
    } else if (criticality === 3 || criticality === 4) {
      return 'text-yellow-600 bg-yellow-50';
    } else if (criticality === 5 || criticality === 6) {
      return 'text-orange-600 bg-orange-50';
    } else if (criticality >= 7) {
      return 'text-red-600 bg-red-50';
    } else {
      return 'text-gray-600 bg-gray-50';
    }
  };

  // Helper to get anomaly label and color by criticité
  const getAnomalyLabelAndColor = (criticality) => {
    if (criticality > 9) return { label: 'Critical anomaly', color: 'bg-red-600 text-white' };
    if (criticality >= 7) return { label: 'High-priority anomaly', color: 'bg-orange-500 text-white' };
    if (criticality >= 3) return { label: 'Standard anomaly', color: 'bg-yellow-400 text-gray-900' };
    return { label: 'Low anomaly', color: 'bg-gray-300 text-gray-700' };
  };

  const handleUnitClick = (unit) => {
    if (unit.anomalies.length > 0) {
      setSelectedUnit(unit);
    }
  };

  const closeModal = () => {
    setSelectedUnit(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading workflow data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Systems Dashboard</h1>
            <p className="text-gray-600">Real-time monitoring and anomaly detection</p>
          </div>
        </header>

        <main className="flex gap-6 h-[calc(100vh-180px)] min-h-0">
          {/* Systems Overview */}
          <section className="flex-1 bg-white rounded-lg shadow border border-gray-200 flex flex-col min-h-0">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Systems Overview</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <div className="grid grid-cols-4 gap-6">
                {units
                  .filter(unit => unit.anomalies.length > 0)
                  .sort((a, b) => b.anomalies.length - a.anomalies.length) // ترتيب تنازلي حسب عدد الأنوماليات
                  .map(unit => {
                    const highestCriticality = getHighestCriticality(unit.anomalies);
                    const colors = getCriticalityColor(highestCriticality);
                    return (
                      <div key={unit.id} className="text-center">
                        <div
                          className={`w-24 h-24 mx-auto mb-3 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-transform duration-200 hover:shadow-lg hover:scale-105 ${colors.bg} ${colors.border}`}
                          onClick={() => handleUnitClick(unit)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter') handleUnitClick(unit); }}
                        >
                          <div className={`w-8 h-8 mb-1 ${colors.text}`}>
                            {unit.anomalies.length === 0 ? (
                              <CheckCircle className="w-full h-full" />
                            ) : (
                              <AlertTriangle className="w-full h-full" />
                            )}
                          </div>
                          <div className="text-xs font-medium text-gray-700 select-none">{unit.anomalies.length}</div>
                        </div>
                        <div className="font-semibold text-gray-800 select-none">{unit.name}</div>
                        <div className={`text-sm ${colors.text} mb-1 select-none`}>
                          {unit.anomalies.length} Anomalies
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        </main>

        {/* Modal for Anomaly Details */}
        {selectedUnit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-lg p-6">
              <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                <h3 className="text-xl font-semibold text-gray-900">{selectedUnit.name} - Anomaly Details</h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                    <span className="font-medium text-red-800">
                      {selectedUnit.anomalies.length} Active Anomalies
                    </span>
                  </div>
                  <p className="text-sm text-red-700">
                    Immediate attention required for optimal performance.
                  </p>
                </div>

                <div className="space-y-3">
                  {selectedUnit.anomalies.map(anomaly => {
                    const { label, color } = getAnomalyLabelAndColor(anomaly.criticality);
                    return (
                      <div key={anomaly.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold mr-2 ${color}`}>{label} (Criticité {anomaly.criticality})</span>
                          <span className="text-xs text-gray-500">ID: {anomaly.id}</span>
                        </div>
                        <div className="flex items-center mb-1">
                          <span className="text-xs font-medium text-blue-700 mr-2">System ID:</span>
                          <span className="text-xs text-blue-900">{anomaly.system_id || anomaly.unit || 'N/A'}</span>
                        </div>
                        <p className="text-sm text-gray-700">{anomaly.description}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    onClick={closeModal}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded transition-colors"
                  >
                    Close
                  </button>
                  {/* <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors">
                    Acknowledge
                  </button> */}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowDashboard;