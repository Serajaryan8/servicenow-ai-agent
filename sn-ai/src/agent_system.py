"""
Flexible Agentic System for ServiceNow Integration
Designed for easy tool addition, removal, and customization
"""

from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import json
import logging
from datetime import datetime


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ToolType(Enum):
    """Tool classification types"""
    QUERY = "query"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    SEARCH = "search"
    CUSTOM = "custom"


@dataclass
class ToolParameter:
    """Define a parameter for a tool"""
    name: str
    type: str  # "string", "integer", "boolean", "array", "object"
    description: str
    required: bool = True
    default: Optional[Any] = None
    enum_values: Optional[List[str]] = None


@dataclass
class Tool:
    """Flexible Tool Definition"""
    name: str
    description: str
    tool_type: ToolType
    handler: Callable  # Function that executes the tool
    parameters: List[ToolParameter] = field(default_factory=list)
    version: str = "1.0"
    enabled: bool = True
    tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert tool to dictionary for LLM context"""
        return {
            "name": self.name,
            "description": self.description,
            "type": self.tool_type.value,
            "parameters": [
                {
                    "name": p.name,
                    "type": p.type,
                    "description": p.description,
                    "required": p.required,
                    "default": p.default,
                    "enum": p.enum_values
                }
                for p in self.parameters
            ],
            "tags": self.tags
        }


@dataclass
class ToolResult:
    """Result from tool execution"""
    tool_name: str
    success: bool
    data: Any
    error: Optional[str] = None
    execution_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class ToolRegistry:
    """Central registry for managing tools - easily add/remove tools dynamically"""
    
    def __init__(self):
        self.tools: Dict[str, Tool] = {}
        self.execution_history: List[Dict[str, Any]] = []
    
    def register_tool(self, tool: Tool) -> None:
        """Register a new tool"""
        if tool.name in self.tools:
            logger.warning(f"Tool '{tool.name}' already registered. Overwriting...")
        self.tools[tool.name] = tool
        logger.info(f"Tool registered: {tool.name}")
    
    def unregister_tool(self, tool_name: str) -> bool:
        """Remove a tool from registry"""
        if tool_name in self.tools:
            del self.tools[tool_name]
            logger.info(f"Tool unregistered: {tool_name}")
            return True
        return False
    
    def get_tool(self, tool_name: str) -> Optional[Tool]:
        """Get a specific tool"""
        return self.tools.get(tool_name)
    
    def list_tools(self, enabled_only: bool = True, tool_type: Optional[ToolType] = None) -> List[Tool]:
        """List available tools with optional filtering"""
        tools = list(self.tools.values())
        
        if enabled_only:
            tools = [t for t in tools if t.enabled]
        
        if tool_type:
            tools = [t for t in tools if t.tool_type == tool_type]
        
        return tools
    
    def execute_tool(self, tool_name: str, params: Dict[str, Any]) -> ToolResult:
        """Execute a tool with given parameters"""
        import time
        
        start_time = time.time()
        
        tool = self.get_tool(tool_name)
        if not tool:
            return ToolResult(
                tool_name=tool_name,
                success=False,
                data=None,
                error=f"Tool '{tool_name}' not found"
            )
        
        if not tool.enabled:
            return ToolResult(
                tool_name=tool_name,
                success=False,
                data=None,
                error=f"Tool '{tool_name}' is disabled"
            )
        
        try:
            # Validate parameters
            self._validate_parameters(tool, params)
            
            # Execute tool
            result_data = tool.handler(**params)
            
            execution_time = time.time() - start_time
            result = ToolResult(
                tool_name=tool_name,
                success=True,
                data=result_data,
                execution_time=execution_time,
                metadata={
                    "executed_at": datetime.now().isoformat(),
                    "params": params
                }
            )
            
            # Log execution
            self.execution_history.append({
                "tool": tool_name,
                "success": True,
                "execution_time": execution_time,
                "timestamp": datetime.now().isoformat()
            })
            
            return result
        
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Tool execution failed: {str(e)}")
            
            self.execution_history.append({
                "tool": tool_name,
                "success": False,
                "error": str(e),
                "execution_time": execution_time,
                "timestamp": datetime.now().isoformat()
            })
            
            return ToolResult(
                tool_name=tool_name,
                success=False,
                data=None,
                error=str(e),
                execution_time=execution_time
            )
    
    def _validate_parameters(self, tool: Tool, params: Dict[str, Any]) -> None:
        """Validate parameters against tool definition"""
        param_map = {p.name: p for p in tool.parameters}
        
        # Check required parameters
        for param in tool.parameters:
            if param.required and param.name not in params:
                raise ValueError(f"Required parameter '{param.name}' not provided")
        
        # Validate provided parameters
        for param_name, param_value in params.items():
            if param_name not in param_map:
                raise ValueError(f"Unknown parameter '{param_name}'")
            
            param_def = param_map[param_name]
            
            # Type checking (basic)
            if param_value is not None:
                expected_type = param_def.type.lower()
                if expected_type == "string" and not isinstance(param_value, str):
                    raise TypeError(f"Parameter '{param_name}' should be string, got {type(param_value)}")
                elif expected_type == "integer" and not isinstance(param_value, int):
                    raise TypeError(f"Parameter '{param_name}' should be integer, got {type(param_value)}")
                
                # Enum validation
                if param_def.enum_values and param_value not in param_def.enum_values:
                    raise ValueError(f"Parameter '{param_name}' value not in allowed values: {param_def.enum_values}")
    
    def get_tools_for_context(self) -> str:
        """Get formatted tool definitions for LLM context"""
        enabled_tools = self.list_tools(enabled_only=True)
        tools_json = [tool.to_dict() for tool in enabled_tools]
        return json.dumps(tools_json, indent=2)
    
    def toggle_tool(self, tool_name: str, enabled: bool) -> bool:
        """Enable/disable a tool"""
        tool = self.get_tool(tool_name)
        if tool:
            tool.enabled = enabled
            status = "enabled" if enabled else "disabled"
            logger.info(f"Tool '{tool_name}' {status}")
            return True
        return False


class Agent:
    """Main Agent class - orchestrates tool usage and decision-making"""
    
    def __init__(self, name: str, tool_registry: ToolRegistry):
        self.name = name
        self.tool_registry = tool_registry
        self.conversation_history: List[Dict[str, Any]] = []
    
    def process_request(self, user_input: str) -> Dict[str, Any]:
        """
        Process user request and determine appropriate tools to use
        Returns structured response with tool calls and results
        """
        logger.info(f"Processing request: {user_input}")
        
        # Add to history
        self.conversation_history.append({
            "type": "user",
            "content": user_input,
            "timestamp": datetime.now().isoformat()
        })
        
        # Step 1: Intent classification (would use LLM in production)
        intent = self._classify_intent(user_input)
        logger.info(f"Detected intent: {intent}")
        
        # Step 2: Select appropriate tools (would use LLM in production)
        selected_tools = self._select_tools(user_input, intent)
        logger.info(f"Selected tools: {[t.name for t in selected_tools]}")
        
        # Step 3: Extract parameters (would use LLM in production)
        tool_calls = []
        for tool in selected_tools:
            params = self._extract_parameters(user_input, tool)
            tool_calls.append({
                "tool_name": tool.name,
                "parameters": params
            })
        
        # Step 4: Execute tools
        tool_results = []
        for tool_call in tool_calls:
            result = self.tool_registry.execute_tool(
                tool_call["tool_name"],
                tool_call["parameters"]
            )
            tool_results.append({
                "tool_name": result.tool_name,
                "success": result.success,
                "data": result.data,
                "error": result.error,
                "execution_time": result.execution_time
            })
        
        # Step 5: Synthesize response (would use LLM in production)
        response = self._synthesize_response(user_input, tool_results)
        
        self.conversation_history.append({
            "type": "assistant",
            "content": response,
            "tool_calls": tool_calls,
            "tool_results": tool_results,
            "timestamp": datetime.now().isoformat()
        })
        
        return {
            "user_input": user_input,
            "intent": intent,
            "selected_tools": [t.name for t in selected_tools],
            "tool_calls": tool_calls,
            "tool_results": tool_results,
            "response": response,
            "timestamp": datetime.now().isoformat()
        }
    
    def _classify_intent(self, user_input: str) -> str:
        """Classify user intent - simplified version"""
        input_lower = user_input.lower()
        
        if any(word in input_lower for word in ["query", "search", "find", "get", "list"]):
            return "query"
        elif any(word in input_lower for word in ["create", "new", "add", "make"]):
            return "create"
        elif any(word in input_lower for word in ["update", "change", "modify", "edit"]):
            return "update"
        else:
            return "general"
    
    def _select_tools(self, user_input: str, intent: str) -> List[Tool]:
        """Select tools based on intent - simplified version"""
        available_tools = self.tool_registry.list_tools(enabled_only=True)
        
        # In production, use LLM to select appropriate tools
        # For now, simple heuristic matching
        selected = []
        for tool in available_tools:
            if intent in tool.tags or f"intent_{intent}" in tool.tags:
                selected.append(tool)
        
        return selected if selected else available_tools[:1]
    
    def _extract_parameters(self, user_input: str, tool: Tool) -> Dict[str, Any]:
        """Extract parameters from user input - placeholder"""
        # In production, use LLM with few-shot examples to extract parameters
        # For now, return empty dict (tool handlers should have defaults)
        return {}
    
    def _synthesize_response(self, user_input: str, tool_results: List[Dict]) -> str:
        """Synthesize final response from tool results - placeholder"""
        success_count = sum(1 for r in tool_results if r["success"])
        return f"Processed request. {success_count}/{len(tool_results)} tools executed successfully."
    
    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """Get conversation history"""
        return self.conversation_history


# Example tool handlers (will be called by tools)

def query_incidents(query: str = "", priority: Optional[str] = None) -> Dict[str, Any]:
    """Handler to query incidents"""
    return {
        "query": query,
        "priority_filter": priority,
        "results": [],
        "count": 0,
        "message": "Query handler - would connect to ServiceNow API"
    }


def create_incident(short_description: str, description: str, category: str) -> Dict[str, Any]:
    """Handler to create incident"""
    return {
        "incident_number": "INC0010999",
        "status": "created",
        "short_description": short_description,
        "category": category
    }


def search_knowledge_base(query: str, limit: int = 5) -> Dict[str, Any]:
    """Handler to search knowledge base"""
    return {
        "query": query,
        "limit": limit,
        "results": [],
        "total_found": 0
    }


# Initialize the system
def initialize_agent() -> Agent:
    """Initialize agent with default tools"""
    
    registry = ToolRegistry()
    
    # Register tools
    query_tool = Tool(
        name="query_incidents",
        description="Search and query ITSM incidents with filters",
        tool_type=ToolType.QUERY,
        handler=query_incidents,
        parameters=[
            ToolParameter("query", "string", "Search query text", required=False),
            ToolParameter("priority", "string", "Priority filter (1-5)", required=False, 
                        enum_values=["1", "2", "3", "4", "5"])
        ],
        tags=["incident", "query", "intent_query"]
    )
    
    create_tool = Tool(
        name="create_incident",
        description="Create a new incident in ServiceNow",
        tool_type=ToolType.CREATE,
        handler=create_incident,
        parameters=[
            ToolParameter("short_description", "string", "Brief incident description", required=True),
            ToolParameter("description", "string", "Detailed incident description", required=True),
            ToolParameter("category", "string", "Incident category", required=True)
        ],
        tags=["incident", "create", "intent_create"]
    )
    
    search_tool = Tool(
        name="search_knowledge_base",
        description="Search knowledge base articles",
        tool_type=ToolType.SEARCH,
        handler=search_knowledge_base,
        parameters=[
            ToolParameter("query", "string", "Search terms", required=True),
            ToolParameter("limit", "integer", "Number of results to return", required=False, default=5)
        ],
        tags=["knowledge", "search", "intent_query"]
    )
    
    registry.register_tool(query_tool)
    registry.register_tool(create_tool)
    registry.register_tool(search_tool)
    
    return Agent("ServiceNow-AI-Agent", registry)


if __name__ == "__main__":
    # Test the agent
    agent = initialize_agent()
    
    # Test requests
    test_requests = [
        "Find incidents with high priority",
        "Create a new incident for network issues",
        "Search knowledge base for password reset"
    ]
    
    for request in test_requests:
        print(f"\n{'='*60}")
        print(f"Request: {request}")
        print('='*60)
        result = agent.process_request(request)
        print(json.dumps(result, indent=2))
