// Utility functions to transform data between frontend and backend formats

// Transform backend anomaly data to frontend format
export const transformAnomalyFromBackend = (backendAnomaly) => {
  return {
    id: backendAnomaly._id,
    title: backendAnomaly.Description || backendAnomaly.description || 'No Title',
    unit: backendAnomaly.system_id || backendAnomaly.unit || 'Unknown Unit',
    severity: mapCriticalityToSeverity(backendAnomaly.criticality),
    priority: mapPriorityScoreToPriority(backendAnomaly.priority_score),
    status: mapBackendStatusToFrontend(backendAnomaly.status),
    date: backendAnomaly['Date de détéction de l\'anomalie'] || backendAnomaly.date_detected || backendAnomaly.created_at || new Date().toISOString().split('T')[0],
    approved: backendAnomaly.Approved || backendAnomaly.approved || false,
    time_span: backendAnomaly.time_span || 0,
    criticality: backendAnomaly.criticality || 1,
    priority_score: backendAnomaly.priority_score || 0,
    scheduled_slot: backendAnomaly.scheduled_slot || null,
    unit_outage: backendAnomaly.unit_outage || false,
    Solution: backendAnomaly.Solution || '',
    // Add any other fields you need
  };
};

// Transform frontend anomaly data to backend format
export const transformAnomalyToBackend = (frontendAnomaly) => {
  return {
    Description: frontendAnomaly.title,
    system_id: frontendAnomaly.unit,
    criticality: mapSeverityToCriticality(frontendAnomaly.severity),
    priority_score: mapPriorityToPriorityScore(frontendAnomaly.priority),
    status: mapFrontendStatusToBackend(frontendAnomaly.status),
    Approved: frontendAnomaly.approved,
    time_span: frontendAnomaly.time_span || 0,
    unit_outage: frontendAnomaly.unit_outage || false,
    Solution: frontendAnomaly.Solution || '',
    // Add any other fields you need
    "Fiabilité Intégrité": frontendAnomaly["Fiabilité Intégrité"],
    "Disponibilté": frontendAnomaly["Disponibilté"],
    "Process Safety": frontendAnomaly["Process Safety"],
  };
};

// Map criticality levels
const mapCriticalityToSeverity = (criticality) => {
  switch (criticality) {
    case 1: return 'Low';
    case 2: return 'Medium';
    case 3: return 'High';
    case 4: return 'Critical';
    default: return 'Medium';
  }
};

const mapSeverityToCriticality = (severity) => {
  switch (severity) {
    case 'Low': return 1;
    case 'Medium': return 2;
    case 'High': return 3;
    case 'Critical': return 4;
    default: return 2;
  }
};

// Map priority scores
const mapPriorityScoreToPriority = (priorityScore) => {
  if (priorityScore >= 15) return 'High';
  if (priorityScore >= 8) return 'Medium';
  return 'Low';
};

const mapPriorityToPriorityScore = (priority) => {
  switch (priority) {
    case 'High': return 15;
    case 'Medium': return 8;
    case 'Low': return 3;
    default: return 8;
  }
};

// Map status values
const mapBackendStatusToFrontend = (backendStatus) => {
  switch (backendStatus) {
    case 'open':
    case 'Open':
      return 'Open';
    case 'in_progress':
    case 'In Progress':
      return 'In Progress';
    case 'resolved':
    case 'Resolved':
      return 'Resolved';
    default:
      return 'Open';
  }
};

const mapFrontendStatusToBackend = (frontendStatus) => {
  switch (frontendStatus) {
    case 'Open':
      return 'open';
    case 'In Progress':
      return 'in_progress';
    case 'Resolved':
      return 'resolved';
    default:
      return 'open';
  }
};

// Transform time slot data
export const transformTimeSlotFromBackend = (backendSlot) => {
  return {
    id: backendSlot._id,
    start_date: backendSlot.start_date,
    end_date: backendSlot.end_date,
    start_time: backendSlot.start_time,
    end_time: backendSlot.end_time,
    duration_hours: backendSlot.duration_hours,
    scheduled_anomalies: backendSlot.scheduled_anomalies || [],
    created_at: backendSlot.created_at,
    updated_at: backendSlot.updated_at,
  };
};

export const transformTimeSlotToBackend = (frontendSlot) => {
  return {
    start_date: frontendSlot.start_date,
    end_date: frontendSlot.end_date,
    start_time: frontendSlot.start_time,
    end_time: frontendSlot.end_time,
    duration_hours: frontendSlot.duration_hours,
  };
};

// Transform statistics data
export const transformStatisticsFromBackend = (backendStats) => {
  return {
    total_anomalies: backendStats.total_anomalies || 0,
    critical_anomalies: backendStats.critical_anomalies || 0,
    high_anomalies: backendStats.high_anomalies || 0,
    medium_anomalies: backendStats.medium_anomalies || 0,
    low_anomalies: backendStats.low_anomalies || 0,
    approved_anomalies: backendStats.approved_anomalies || 0,
    scheduled_anomalies: backendStats.scheduled_anomalies || 0,
    unit_count: backendStats.unit_count || 0,
    unit_outages: backendStats.unit_outages || 0,
  };
};

// Helper function to format dates
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch (error) {
    return dateString;
  }
};

// Helper function to format time
export const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  
  try {
    // Assuming time is in HH:MM format
    return timeString;
  } catch (error) {
    return timeString;
  }
};

// Helper function to calculate resolution rate
export const calculateResolutionRate = (anomalies) => {
  if (!anomalies || anomalies.length === 0) return 0;
  
  const resolved = anomalies.filter(a => a.status === 'Resolved').length;
  return Math.round((resolved / anomalies.length) * 100);
};

// Helper function to get critical issues count
export const getCriticalIssuesCount = (anomalies) => {
  if (!anomalies) return 0;
  
  return anomalies.filter(a => 
    a.severity === 'Critical' || a.severity === 'High'
  ).length;
}; 