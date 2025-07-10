# Test Suite for Anomaly Management System

This directory contains comprehensive tests for the MongoDB service and API endpoints with the new reference-based structure and scheduling functionality.

## 📁 Test Files

### 1. `test_mongodb_service.py`
**Unit tests for MongoDB service functionality**
- Tests reference-based data structure
- Tests approved anomalies queue
- Tests scheduling and rescheduling logic
- Tests time slot management
- Uses mocking to avoid real database connections

### 2. `test_api_endpoints.py`
**API endpoint tests using Django TestCase**
- Tests all REST API endpoints
- Tests authentication and permissions
- Tests error handling
- Uses Django's test client with JWT authentication

### 3. `run_tests.py`
**Test runner script**
- Runs all test suites
- Generates comprehensive reports
- Provides success/failure summaries

### 4. `test_curl_commands.sh`
**Manual curl testing script**
- Real HTTP requests to running server
- Tests actual API behavior
- Requires valid JWT token

## 🚀 Running Tests

### Prerequisites
```bash
# Install required packages
pip install pytest pytest-django
pip install djangorestframework-simplejwt

# Set up Django environment
export DJANGO_SETTINGS_MODULE=your_project.settings
```

### 1. Run All Tests
```bash
python run_tests.py
```

### 2. Run Individual Test Files
```bash
# Unit tests only
python -m unittest test_mongodb_service.py -v

# API tests only
python -m unittest test_api_endpoints.py -v
```

### 3. Run Manual Curl Tests
```bash
# Make script executable
chmod +x test_curl_commands.sh

# Edit script to add your JWT token
nano test_curl_commands.sh

# Run tests
./test_curl_commands.sh
```

## 🧪 Test Coverage

### MongoDB Service Tests
- ✅ **Reference-based data structure**
  - Insert anomalies with unit references
  - Retrieve anomalies by system using references
  - Update anomalies across collections
  - Count anomalies by system

- ✅ **Approved anomalies queue**
  - Add anomalies to queue
  - Remove anomalies from queue
  - Get queue with priority sorting
  - Check and schedule from queue

- ✅ **Scheduling logic**
  - Schedule anomalies to available slots
  - Reschedule when slots change
  - Fallback to queue when rescheduling fails
  - Move anomalies to earlier slots

- ✅ **Time slot management**
  - Create slots with auto-scheduling
  - Update slots with rescheduling
  - Merge overlapping slots
  - Handle slot conflicts

### API Endpoint Tests
- ✅ **Authentication & Authorization**
  - JWT token validation
  - Admin permission requirements
  - Unauthorized access handling

- ✅ **CRUD Operations**
  - Approve anomalies
  - Create/update time slots
  - Manage approved queue
  - Get anomalies by system

- ✅ **Error Handling**
  - Invalid data validation
  - Non-existent resource handling
  - Database connection errors

## 📊 Test Scenarios

### Scenario 1: Complete Workflow
1. **Insert anomalies** → Verify reference structure
2. **Approve anomaly** → Check queue addition
3. **Create time slot** → Verify auto-scheduling
4. **Update slot** → Check rescheduling
5. **Remove from queue** → Verify cleanup

### Scenario 2: Scheduling Priority
1. **Add multiple anomalies** to queue with different criticality
2. **Create slot** → Verify highest criticality scheduled first
3. **Create earlier slot** → Verify existing anomalies moved

### Scenario 3: Error Handling
1. **Invalid anomaly ID** → Check 404 response
2. **Invalid slot data** → Check validation errors
3. **Unauthorized access** → Check 403 response

## 🔧 Test Configuration

### Environment Variables
```bash
# Required for Django tests
export DJANGO_SETTINGS_MODULE=your_project.settings

# Optional: MongoDB connection for integration tests
export MONGODB_URI=mongodb://localhost:27017/test_db
```

### Mock Configuration
The unit tests use extensive mocking to avoid:
- Real database connections
- External service dependencies
- File system operations

### Test Data
Test data is generated programmatically and includes:
- Sample anomalies with various criticality levels
- Time slots with different durations
- Queue entries with priority information

## 📈 Interpreting Results

### Success Indicators
- ✅ All unit tests pass
- ✅ All API tests pass
- ✅ No authentication errors
- ✅ Proper error handling

### Common Issues
- ❌ **Import errors**: Check Python path and Django settings
- ❌ **Authentication failures**: Verify JWT token configuration
- ❌ **Database errors**: Check MongoDB connection
- ❌ **Permission errors**: Verify user has admin privileges

### Performance Metrics
- Unit tests: ~2-5 seconds
- API tests: ~5-10 seconds
- Curl tests: ~10-30 seconds (depends on server response)

## 🛠️ Debugging Tests

### Enable Verbose Output
```bash
python -m unittest test_mongodb_service.py -v
```

### Debug Specific Test
```bash
python -m unittest test_mongodb_service.TestMongoDBService.test_insert_anomalies_with_references -v
```

### Check Test Coverage
```bash
# Install coverage
pip install coverage

# Run with coverage
coverage run -m unittest test_mongodb_service.py
coverage report
```

## 📝 Adding New Tests

### For MongoDB Service
```python
def test_new_feature(self):
    """Test description."""
    # Setup
    mock_data = {...}
    
    # Execute
    result = self.service.new_method(mock_data)
    
    # Assertions
    self.assertTrue(result['success'])
    self.assertEqual(result['count'], expected_value)
```

### For API Endpoints
```python
@patch('anomalies.views.get_mongodb_service')
def test_new_endpoint(self, mock_get_service):
    """Test new API endpoint."""
    # Setup mock
    mock_service = Mock()
    mock_get_service.return_value = mock_service
    mock_service.new_method.return_value = {...}
    
    # Execute
    response = self.client.post(reverse('anomalies:new-endpoint'), data={})
    
    # Assertions
    self.assertEqual(response.status_code, status.HTTP_200_OK)
```

## 🎯 Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Dependencies**: Avoid real database calls in unit tests
3. **Clear Test Names**: Use descriptive test method names
4. **Comprehensive Assertions**: Test both success and failure cases
5. **Error Scenarios**: Always test error conditions
6. **Performance**: Keep tests fast and efficient

## 📞 Support

If you encounter issues with the tests:
1. Check the error messages carefully
2. Verify your Django and MongoDB setup
3. Ensure all dependencies are installed
4. Check the test configuration

For specific issues, refer to the individual test files for detailed implementation. 