import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Check, Eye, FileText, Loader, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiService } from '../services/apiService';

const ExcelFileUpload = () => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [excelData, setExcelData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [importType, setImportType] = useState('anomalies'); // 'anomalies' or 'time-slots'

  const processExcelFile = useCallback((file) => {
    setIsProcessing(true);
    setError(null);
    setNotification(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        setExcelData({
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(2) + ' KB',
          sheets: workbook.SheetNames,
          rowCount: jsonData.length,
          data: jsonData.slice(0, 10), // Show first 10 rows
          allData: jsonData
        });
        
        setUploadedFile(file);
        setIsProcessing(false);
      } catch (err) {
        setError('Failed to process Excel file. Please ensure it\'s a valid Excel file.');
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' || 
          file.name.endsWith('.xlsx') || 
          file.name.endsWith('.xls')) {
        processExcelFile(file);
      } else {
        setError('Please upload a valid Excel file (.xlsx or .xls)');
      }
    }
  }, [processExcelFile]);

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      processExcelFile(file);
    }
  }, [processExcelFile]);

  const handleCancelFile = () => {
    setUploadedFile(null);
    setExcelData(null);
    setError(null);
    setNotification(null);
  };

  const handleApproveData = async () => {
    if (excelData && uploadedFile) {
      setIsUploading(true);
      setError(null);
      
      try {
        let result;
        if (importType === 'anomalies') {
          result = await apiService.uploadAnomalies(uploadedFile);
        } else {
          result = await apiService.importTimeSlots(uploadedFile);
        }
        
        if (result.success) {
          const message = importType === 'anomalies' 
            ? `Successfully imported ${result.imported_count} anomalies to the system!`
            : `Successfully imported ${result.inserted} time slots to the system!`;
          
          setNotification({
            type: 'success',
            message: message
          });
          
          // Clear the form
          setUploadedFile(null);
          setExcelData(null);
          
          // Auto-hide notification after 5 seconds
          setTimeout(() => {
            setNotification(null);
          }, 5000);
        } else {
          setError(`Import failed: ${result.message || result.error || 'Unknown error'}`);
          if (result.errors && result.errors.length > 0) {
            console.error('Import errors:', result.errors);
          }
        }
      } catch (err) {
        console.error('Upload error:', err);
        setError(`Upload failed: ${err.message || 'Network error'}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Import</h1>
          <p className="text-gray-600">Import anomalies and time slots from Excel files</p>
        </div>

        {/* Import Type Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Import Type</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setImportType('anomalies')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                importType === 'anomalies'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Import Anomalies
            </button>
            <button
              onClick={() => setImportType('time-slots')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                importType === 'time-slots'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Clock className="h-4 w-4" />
              Import Time Slots
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {importType === 'anomalies' 
              ? 'Upload Excel file containing anomaly data to import into the system.'
              : 'Upload Excel file containing maintenance time slots to schedule anomalies.'
            }
          </p>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <p className="font-medium">{notification.message}</p>
            </div>
          </div>
        )}

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
              isDragging
                ? 'border-blue-400 bg-blue-50'
                : uploadedFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Processing your Excel file...</p>
              </div>
            ) : uploadedFile ? (
              <div className="flex flex-col items-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-lg font-medium text-gray-800 mb-2">File uploaded successfully!</p>
                <p className="text-gray-600 mb-4">{uploadedFile.name}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelFile}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleApproveData}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Import to System
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <FileSpreadsheet className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-800 mb-2">
                  Drag and drop your Excel file here
                </p>
                <p className="text-gray-600 mb-4">or click to select a file</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  <Upload className="h-5 w-5" />
                  Select Excel File
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* File Information */}
        {excelData && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">File Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">File Name</span>
                </div>
                <p className="text-gray-700 text-sm">{excelData.fileName}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">File Size</span>
                </div>
                <p className="text-gray-700 text-sm">{excelData.fileSize}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Sheets</span>
                </div>
                <p className="text-gray-700 text-sm">{excelData.sheets.length}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">Rows</span>
                </div>
                <p className="text-gray-700 text-sm">{excelData.rowCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Data Preview */}
        {excelData && excelData.data && excelData.data.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Data Preview</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(excelData.data[0]).map((key) => (
                      <th key={key} className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelData.data.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {Object.values(row).map((value, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 text-sm text-gray-600 border-b">
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {excelData.rowCount > 10 && (
              <p className="text-sm text-gray-500 mt-4">
                Showing first 10 rows of {excelData.rowCount} total rows
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelFileUpload;