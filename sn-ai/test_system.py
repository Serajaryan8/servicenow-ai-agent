"""
Test and Example Usage of the ServiceNow AI Agent
Run this file to verify everything is working correctly
"""

import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.agent_system import (
    initialize_agent, Tool, ToolType, ToolParameter, ToolRegistry
)
from src.servicenow_api import MockServiceNowAPI


def test_agent_basic():
    """Test basic agent functionality"""
    print("\n" + "="*60)
    print("TEST 1: Basic Agent Initialization")
    print("="*60)
    
    try:
        agent = initialize_agent()
        print(f"✓ Agent initialized: {agent.name}")
        print(f"✓ Available tools: {len(agent.tool_registry.list_tools())}")
        
        for tool in agent.tool_registry.list_tools():
            print(f"  - {tool.name}: {tool.description}")
        
        return True
    except Exception as e:
        print(f"✗ Agent initialization failed: {str(e)}")
        return False


def test_mock_api():
    """Test mock ServiceNow API"""
    print("\n" + "="*60)
    print("TEST 2: Mock ServiceNow API")
    print("="*60)
    
    try:
        api = MockServiceNowAPI()
        
        # Test incident query
        print("\n1. Querying incidents with 'password'...")
        incidents = api.query_incidents(query="password")
        print(f"✓ Found {incidents['count']} incidents")
        if incidents['incidents']:
            inc = incidents['incidents'][0]
            print(f"  - {inc['number']}: {inc['short_description']}")
        
        # Test KB search
        print("\n2. Searching knowledge base for 'VPN'...")
        kb = api.search_knowledge_base(query="VPN", limit=3)
        print(f"✓ Found {kb['count']} articles")
        if kb['articles']:
            article = kb['articles'][0]
            print(f"  - {article['number']}: {article['short_description']}")
        
        # Test priority filter
        print("\n3. Querying incidents with priority=2...")
        incidents = api.query_incidents(priority="2")
        print(f"✓ Found {incidents['count']} incidents with priority 2")
        
        return True
    except Exception as e:
        print(f"✗ Mock API test failed: {str(e)}")
        return False


def test_agent_processing():
    """Test agent request processing"""
    print("\n" + "="*60)
    print("TEST 3: Agent Request Processing")
    print("="*60)
    
    try:
        agent = initialize_agent()
        
        test_requests = [
            "Find incidents with high priority",
            "Create a new incident for network issues",
            "Search knowledge base for password reset"
        ]
        
        for i, request in enumerate(test_requests, 1):
            print(f"\n{i}. Processing: '{request}'")
            result = agent.process_request(request)
            
            print(f"   Intent: {result['intent']}")
            print(f"   Selected tools: {result['selected_tools']}")
            print(f"   Response: {result['response']}")
        
        return True
    except Exception as e:
        print(f"✗ Agent processing failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_custom_tool_registration():
    """Test adding custom tools"""
    print("\n" + "="*60)
    print("TEST 4: Custom Tool Registration")
    print("="*60)
    
    try:
        # Create custom tool
        def custom_handler(name: str) -> dict:
            return {"message": f"Hello, {name}!"}
        
        custom_tool = Tool(
            name="greeting_tool",
            description="A simple greeting tool",
            tool_type=ToolType.CUSTOM,
            handler=custom_handler,
            parameters=[
                ToolParameter("name", "string", "Person to greet", required=True)
            ],
            tags=["custom", "test"]
        )
        
        # Create registry and register tool
        registry = ToolRegistry()
        registry.register_tool(custom_tool)
        
        print(f"✓ Custom tool registered: {custom_tool.name}")
        
        # Execute custom tool
        result = registry.execute_tool("greeting_tool", {"name": "World"})
        print(f"✓ Tool executed: {result.data}")
        
        # Disable and check
        registry.toggle_tool("greeting_tool", False)
        result2 = registry.execute_tool("greeting_tool", {"name": "Test"})
        print(f"✓ Tool disabled correctly: {result2.error is not None}")
        
        return True
    except Exception as e:
        print(f"✗ Custom tool test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_data_loading():
    """Test sample ITSM data loading"""
    print("\n" + "="*60)
    print("TEST 5: Sample ITSM Data Loading")
    print("="*60)
    
    try:
        data_file = Path(__file__).parent / "data" / "sample_itsm_data.json"
        
        with open(data_file, 'r') as f:
            data = json.load(f)
        
        print(f"✓ Loaded {len(data)} records from {data_file.name}")
        
        # Organize by type
        types = {}
        for item in data:
            item_type = item.get("type", "unknown")
            types[item_type] = types.get(item_type, 0) + 1
        
        print("\nRecord types:")
        for item_type, count in types.items():
            print(f"  - {item_type}: {count} records")
        
        # Show sample records
        print("\nSample records:")
        for item in data[:3]:
            print(f"  - {item.get('number', 'N/A')}: {item.get('short_description', 'N/A')}")
        
        return True
    except Exception as e:
        print(f"✗ Data loading failed: {str(e)}")
        return False


def test_parameter_validation():
    """Test tool parameter validation"""
    print("\n" + "="*60)
    print("TEST 6: Parameter Validation")
    print("="*60)
    
    try:
        def handler_func(required_param: str, optional_param: str = "default"):
            return {"result": f"{required_param}-{optional_param}"}
        
        tool = Tool(
            name="validation_test",
            description="Test parameter validation",
            tool_type=ToolType.CUSTOM,
            handler=handler_func,
            parameters=[
                ToolParameter("required_param", "string", "Required param", required=True),
                ToolParameter("optional_param", "string", "Optional param", required=False, default="default")
            ]
        )
        
        registry = ToolRegistry()
        registry.register_tool(tool)
        
        # Test 1: Valid execution
        print("\n1. Testing with required param only...")
        result1 = registry.execute_tool("validation_test", {"required_param": "test"})
        print(f"✓ Success: {result1.data}")
        
        # Test 2: Valid execution with both params
        print("\n2. Testing with both params...")
        result2 = registry.execute_tool("validation_test", {
            "required_param": "test",
            "optional_param": "custom"
        })
        print(f"✓ Success: {result2.data}")
        
        # Test 3: Missing required param
        print("\n3. Testing missing required param (should fail)...")
        result3 = registry.execute_tool("validation_test", {"optional_param": "test"})
        print(f"✓ Correctly caught error: {result3.error is not None}")
        
        return True
    except Exception as e:
        print(f"✗ Parameter validation test failed: {str(e)}")
        return False


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*70)
    print("ServiceNow AI Agent - Test Suite")
    print("="*70)
    
    tests = [
        ("Agent Initialization", test_agent_basic),
        ("Mock API", test_mock_api),
        ("Agent Processing", test_agent_processing),
        ("Custom Tool Registration", test_custom_tool_registration),
        ("Data Loading", test_data_loading),
        ("Parameter Validation", test_parameter_validation)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n✗ {test_name} failed with exception: {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! System is ready to use.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Check errors above.")
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
