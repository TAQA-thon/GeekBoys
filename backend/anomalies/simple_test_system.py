#!/usr/bin/env python3
"""
Simple test script for system-specific anomaly endpoints.
Tests both getting anomalies by system and counting anomalies by system.
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"

def test_system_anomalies(unit_id, limit=10, skip=0):
    """Test getting anomalies by system."""
    print(f"\n🔍 Testing get anomalies by system (unit_id: {unit_id})")
    print(f"   URL: {BASE_URL}/api/anomalies/system/{unit_id}/")
    print(f"   Parameters: limit={limit}, skip={skip}")
    
    try:
        url = f"{BASE_URL}/api/anomalies/system/{unit_id}/"
        params = {"limit": limit, "skip": skip}
        
        response = requests.get(url, params=params)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Success!")
            print(f"   📊 Response:")
            print(f"      - Success: {data.get('success')}")
            print(f"      - Unit ID: {data.get('unit_id')}")
            print(f"      - Count: {data.get('count')}")
            print(f"      - Limit: {data.get('limit')}")
            print(f"      - Skip: {data.get('skip')}")
            print(f"      - Message: {data.get('message')}")
            
            # Show first few anomalies if any
            anomalies = data.get('anomalies', [])
            if anomalies:
                print(f"   📋 First anomaly sample:")
                first_anomaly = anomalies[0]
                for key, value in list(first_anomaly.items())[:5]:  # Show first 5 fields
                    print(f"      - {key}: {value}")
                if len(anomalies) > 1:
                    print(f"      - ... and {len(anomalies) - 1} more anomalies")
            else:
                print(f"   📋 No anomalies found in this system")
                
        elif response.status_code == 401:
            print(f"   🔒 Authentication required (expected)")
        else:
            print(f"   ❌ Error: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error details: {error_data}")
            except:
                print(f"   Error text: {response.text}")
                
    except Exception as e:
        print(f"   ❌ Exception: {str(e)}")

def test_system_count(unit_id):
    """Test counting anomalies by system."""
    print(f"\n🔢 Testing count anomalies by system (unit_id: {unit_id})")
    print(f"   URL: {BASE_URL}/api/anomalies/system/{unit_id}/count/")
    
    try:
        url = f"{BASE_URL}/api/anomalies/system/{unit_id}/count/"
        
        response = requests.get(url)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Success!")
            print(f"   📊 Response:")
            print(f"      - Success: {data.get('success')}")
            print(f"      - Unit ID: {data.get('unit_id')}")
            print(f"      - Count: {data.get('count')}")
            print(f"      - Message: {data.get('message')}")
                
        elif response.status_code == 401:
            print(f"   🔒 Authentication required (expected)")
        else:
            print(f"   ❌ Error: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error details: {error_data}")
            except:
                print(f"   Error text: {response.text}")
                
    except Exception as e:
        print(f"   ❌ Exception: {str(e)}")

def test_invalid_parameters():
    """Test with invalid parameters."""
    print(f"\n⚠️  Testing invalid parameters")
    
    # Test with invalid limit
    print(f"\n   Testing invalid limit parameter:")
    try:
        url = f"{BASE_URL}/api/anomalies/system/1/"
        params = {"limit": "invalid"}
        
        response = requests.get(url, params=params)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 400:
            print(f"   ✅ Correctly rejected invalid limit")
        elif response.status_code == 401:
            print(f"   🔒 Authentication required (expected)")
        else:
            print(f"   ❌ Should have rejected invalid limit")
            
    except Exception as e:
        print(f"   ❌ Exception: {str(e)}")

def main():
    """Main test function."""
    print("🚀 Testing System-Specific Anomaly Endpoints")
    print("=" * 50)
    
    # Test with different system IDs
    test_system_ids = ["1", "2", "3", "10", "100"]
    
    for unit_id in test_system_ids:
        # Test getting anomalies
        test_system_anomalies(unit_id, limit=5, skip=0)
        
        # Test counting anomalies
        test_system_count(unit_id)
    
    # Test with different pagination parameters
    print(f"\n📄 Testing pagination parameters:")
    test_system_anomalies("1", limit=3, skip=0)
    test_system_anomalies("1", limit=3, skip=3)
    
    # Test invalid parameters
    test_invalid_parameters()
    
    print(f"\n✅ Testing completed!")
    print(f"\n📝 Note: 401 responses are expected since we're not providing authentication.")
    print(f"   This confirms the endpoints exist and are properly protected.")

if __name__ == "__main__":
    main() 