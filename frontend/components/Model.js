import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, Clock, Database, Settings, Cpu, BarChart3 } from 'lucide-react';

const ModelDashboard = () => {
  const isTraining = true; // Model is always training

  // Training data
  const trainingData = [
    { epoch: 1, loss: 0.95, accuracy: 65 },
    { epoch: 2, loss: 0.82, accuracy: 72 },
    { epoch: 3, loss: 0.71, accuracy: 78 },
    { epoch: 4, loss: 0.64, accuracy: 83 },
    { epoch: 5, loss: 0.58, accuracy: 87 },
    { epoch: 6, loss: 0.52, accuracy: 89 },
    { epoch: 7, loss: 0.48, accuracy: 91 },
    { epoch: 8, loss: 0.45, accuracy: 92 },
  ];

  // Model information
  const modelInfo = {
    name: "ResNet-50 Classifier",
    type: "Convolutional Neural Network",
    dataset: "ImageNet-1K",
    datasetSize: "1.2M images",
    classes: 1000,
    inputSize: "224x224x3",
    parameters: "25.6M",
    modelSize: "98.3 MB",
    learningRate: 0.001,
    batchSize: 32,
    optimizer: "Adam",
    lossFunction: "CrossEntropy",
    framework: "PyTorch",
    device: "CUDA GPU"
  };
  const currentAccuracy = 92;
  const currentLoss = 0.45;
  const currentEpoch = 8;
  const totalEpochs = 100;
  const trainingTime = "2h 34m";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Model Training</h1>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isTraining ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-gray-600">{isTraining ? 'Training' : 'Stopped'}</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Accuracy</p>
                <p className="text-2xl font-bold text-green-600">{currentAccuracy}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Loss</p>
                <p className="text-2xl font-bold text-red-600">{currentLoss}</p>
              </div>
              <Activity className="w-8 h-8 text-red-500" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Time</p>
                <p className="text-2xl font-bold text-blue-600">{trainingTime}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Progress</h3>
            <span className="text-sm text-gray-600">Epoch {currentEpoch}/{totalEpochs}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className="bg-blue-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${(currentEpoch / totalEpochs) * 100}%` }}
            ></div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {Math.round((currentEpoch / totalEpochs) * 100)}% Complete
          </div>
        </div>

        {/* Training Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h3 className="text-lg font-semibold mb-4">Training Progress</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trainingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="epoch" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke="#22c55e" 
                strokeWidth={3}
                name="Accuracy (%)"
              />
              <Line 
                type="monotone" 
                dataKey="loss" 
                stroke="#ef4444" 
                strokeWidth={3}
                name="Loss"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>





      </div>
    </div>
  );
};

export default ModelDashboard;