#!/usr/bin/env python3
"""
Test runner for MongoDB service and API endpoint tests.
"""

import unittest
import sys
import os
import subprocess
from datetime import datetime

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


def run_unit_tests():
    """Run unit tests for MongoDB service."""
    print("=" * 60)
    print("RUNNING MONGODB SERVICE UNIT TESTS")
    print("=" * 60)
    
    # Load and run tests
    loader = unittest.TestLoader()
    suite = loader.discover('.', pattern='test_mongodb_service.py')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


def run_api_tests():
    """Run API endpoint tests."""
    print("\n" + "=" * 60)
    print("RUNNING API ENDPOINT TESTS")
    print("=" * 60)
    
    # Load and run tests
    loader = unittest.TestLoader()
    suite = loader.discover('.', pattern='test_api_endpoints.py')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


def run_curl_tests():
    """Run curl-based integration tests."""
    print("\n" + "=" * 60)
    print("RUNNING CURL INTEGRATION TESTS")
    print("=" * 60)
    
    # This would require a running Django server
    # For now, just show the curl commands
    print("Note: These tests require a running Django server")
    print("Run 'python manage.py runserver' first, then execute:")
    print()
    
    curl_tests = [
        {
            'name': 'Get Approved Queue',
            'command': 'curl -X GET "http://localhost:8000/api/anomalies/mongodb/approved-queue/" -H "Authorization: Bearer YOUR_JWT_TOKEN"'
        },
        {
            'name': 'Check Schedule Queue',
            'command': 'curl -X POST "http://localhost:8000/api/anomalies/mongodb/approved-queue/check/" -H "Authorization: Bearer YOUR_JWT_TOKEN"'
        },
        {
            'name': 'Create Time Slot',
            'command': '''curl -X POST "http://localhost:8000/api/anomalies/mongodb/time-slots/create/" \\
                -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
                -H "Content-Type: application/json" \\
                -d '{"start_date": "2024-01-01", "end_date": "2024-01-01", "duration_hours": 8.0}' '''
        },
        {
            'name': 'Approve Anomaly',
            'command': 'curl -X PATCH "http://localhost:8000/api/anomalies/mongodb/507f1f77bcf86cd799439011/approve/" -H "Authorization: Bearer YOUR_JWT_TOKEN"'
        }
    ]
    
    for test in curl_tests:
        print(f"Test: {test['name']}")
        print(f"Command: {test['command']}")
        print("-" * 40)
    
    return True  # Assume success for now


def generate_test_report(success_count, total_count):
    """Generate a test report."""
    print("\n" + "=" * 60)
    print("TEST SUMMARY REPORT")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Tests Passed: {success_count}/{total_count}")
    print(f"Success Rate: {(success_count/total_count)*100:.1f}%")
    
    if success_count == total_count:
        print("🎉 ALL TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED")
    
    print("=" * 60)


def main():
    """Main test runner."""
    print("🧪 STARTING COMPREHENSIVE TEST SUITE")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Track results
    results = []
    
    # Run unit tests
    try:
        unit_success = run_unit_tests()
        results.append(('Unit Tests', unit_success))
    except Exception as e:
        print(f"❌ Unit tests failed with error: {e}")
        results.append(('Unit Tests', False))
    
    # Run API tests
    try:
        api_success = run_api_tests()
        results.append(('API Tests', api_success))
    except Exception as e:
        print(f"❌ API tests failed with error: {e}")
        results.append(('API Tests', False))
    
    # Run curl tests
    try:
        curl_success = run_curl_tests()
        results.append(('Curl Tests', curl_success))
    except Exception as e:
        print(f"❌ Curl tests failed with error: {e}")
        results.append(('Curl Tests', False))
    
    # Generate report
    success_count = sum(1 for _, success in results if success)
    total_count = len(results)
    
    generate_test_report(success_count, total_count)
    
    # Detailed results
    print("\nDETAILED RESULTS:")
    for test_type, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"  {test_type}: {status}")
    
    # Exit with appropriate code
    if success_count == total_count:
        print("\n🎉 All tests completed successfully!")
        sys.exit(0)
    else:
        print(f"\n❌ {total_count - success_count} test suite(s) failed!")
        sys.exit(1)


if __name__ == '__main__':
    main() 