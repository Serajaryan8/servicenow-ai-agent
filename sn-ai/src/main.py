"""
FastAPI Application
Main entry point for the agentic ServiceNow AI system
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import json
import logging
from datetime import datetime

from src.agent_system import Agent, ToolRegistry, Tool, ToolType, ToolParameter, initialize_agent
from src.servicenow_api import MockServiceNowAPI, ServiceNowAPI, ServiceNowConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ServiceNow AI Agent",
    description="Intelligent agent for ServiceNow ITSM operations",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global agent instance
agent: Optional[Agent] = None
servicenow_api: Optional[MockServiceNowAPI] = None


# Pydantic Models
class QueryRequest(BaseModel):
    """Request model for querying incidents"""
    query: str = Field(..., description="Search query")
    priority: Optional[str] = Field(None, description="Priority filter (1-5)")
    limit: int = Field(10, description="Number of results")


class CreateIncidentRequest(BaseModel):
    """Request model for creating incident"""
    short_description: str = Field(..., description="Brief incident description")
    description: str = Field(..., description="Detailed description")
    category: str = Field(..., description="Incident category")
    urgency: str = Field("3", description="Urgency level (1-5)")


class AgentRequest(BaseModel):
    """Request model for agent processing"""
    user_input: str = Field(..., description="User request to process")
    include_tools: Optional[List[str]] = Field(None, description="Specific tools to use")


class AgentResponse(BaseModel):
    """Response model from agent"""
    user_input: str
    intent: str
    selected_tools: List[str]
    tool_calls: List[Dict[str, Any]]
    tool_results: List[Dict[str, Any]]
    response: str
    timestamp: str


class ToolInfo(BaseModel):
    """Tool information"""
    name: str
    description: str
    type: str
    parameters: List[Dict[str, Any]]
    enabled: bool
    tags: List[str]


# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize agent and API on startup"""
    global agent, servicenow_api
    
    logger.info("Initializing ServiceNow AI Agent...")
    
    # Initialize agent
    agent = initialize_agent()
    
    # Initialize ServiceNow API (using mock for demo)
    servicenow_api = MockServiceNowAPI()
    
    # Register additional tools that interact with ServiceNow
    register_servicenow_tools()
    
    logger.info("Agent initialized successfully")


def register_servicenow_tools():
    """Register ServiceNow-specific tools"""
    
    # Create ServiceNow-specific handlers
    def query_incidents_handler(query: str = "", priority: Optional[str] = None) -> Dict[str, Any]:
        """Query incidents from ServiceNow"""
        try:
            result = servicenow_api.query_incidents(query=query, priority=priority)
            return {
                "success": True,
                "data": result,
                "message": f"Found {result['count']} incidents"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def search_kb_handler(query: str, limit: int = 5) -> Dict[str, Any]:
        """Search knowledge base"""
        try:
            result = servicenow_api.search_knowledge_base(query=query, limit=limit)
            return {
                "success": True,
                "data": result,
                "message": f"Found {result['count']} knowledge articles"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # Register tools
    sn_query_tool = Tool(
        name="query_incidents_sn",
        description="Query incidents from ServiceNow ITSM",
        tool_type=ToolType.QUERY,
        handler=query_incidents_handler,
        parameters=[
            ToolParameter("query", "string", "Search query text", required=False),
            ToolParameter("priority", "string", "Priority filter (1-5)", required=False)
        ],
        tags=["servicenow", "incident", "query"],
        enabled=True
    )
    
    sn_kb_tool = Tool(
        name="search_kb_sn",
        description="Search ServiceNow knowledge base for solutions",
        tool_type=ToolType.SEARCH,
        handler=search_kb_handler,
        parameters=[
            ToolParameter("query", "string", "Search query", required=True),
            ToolParameter("limit", "integer", "Number of results", required=False, default=5)
        ],
        tags=["servicenow", "knowledge", "search"],
        enabled=True
    )
    
    agent.tool_registry.register_tool(sn_query_tool)
    agent.tool_registry.register_tool(sn_kb_tool)


# API Endpoints

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "ServiceNow AI Agent API",
        "version": "1.0.0",
        "endpoints": {
            "agent_process": "/agent/process",
            "tools_list": "/tools",
            "tool_details": "/tools/{tool_name}",
            "health": "/health"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent_initialized": agent is not None,
        "timestamp": datetime.now().isoformat()
    }


# Agent Endpoints

@app.post("/agent/process", response_model=AgentResponse)
async def process_agent_request(request: AgentRequest):
    """
    Process user request through the agent
    
    The agent will:
    1. Classify the intent
    2. Select appropriate tools
    3. Execute tools
    4. Synthesize response
    """
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        result = agent.process_request(request.user_input)
        return AgentResponse(**result)
    
    except Exception as e:
        logger.error(f"Agent processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/agent/history")
async def get_conversation_history():
    """Get conversation history"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    return {
        "history": agent.get_conversation_history(),
        "count": len(agent.conversation_history)
    }


@app.get("/agent/clear-history")
async def clear_history():
    """Clear conversation history"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    agent.conversation_history.clear()
    return {"message": "History cleared"}


# Tools Endpoints

@app.get("/tools", response_model=List[ToolInfo])
async def list_tools(enabled_only: bool = True):
    """List available tools"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    tools = agent.tool_registry.list_tools(enabled_only=enabled_only)
    return [
        ToolInfo(
            name=tool.name,
            description=tool.description,
            type=tool.tool_type.value,
            parameters=[
                {
                    "name": p.name,
                    "type": p.type,
                    "description": p.description,
                    "required": p.required
                }
                for p in tool.parameters
            ],
            enabled=tool.enabled,
            tags=tool.tags
        )
        for tool in tools
    ]


@app.get("/tools/{tool_name}", response_model=ToolInfo)
async def get_tool_details(tool_name: str):
    """Get details of specific tool"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    tool = agent.tool_registry.get_tool(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
    
    return ToolInfo(
        name=tool.name,
        description=tool.description,
        type=tool.tool_type.value,
        parameters=[
            {
                "name": p.name,
                "type": p.type,
                "description": p.description,
                "required": p.required
            }
            for p in tool.parameters
        ],
        enabled=tool.enabled,
        tags=tool.tags
    )


@app.post("/tools/{tool_name}/toggle")
async def toggle_tool(tool_name: str, enabled: bool):
    """Enable/disable a tool"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    success = agent.tool_registry.toggle_tool(tool_name, enabled)
    if not success:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
    
    return {
        "tool_name": tool_name,
        "enabled": enabled,
        "message": f"Tool '{tool_name}' is now {'enabled' if enabled else 'disabled'}"
    }


# ServiceNow Endpoints

@app.post("/servicenow/query-incidents")
async def query_incidents(request: QueryRequest):
    """Query incidents from ServiceNow"""
    if not servicenow_api:
        raise HTTPException(status_code=503, detail="ServiceNow API not initialized")
    
    try:
        result = servicenow_api.query_incidents(
            query=request.query,
            priority=request.priority,
            limit=request.limit
        )
        return result
    
    except Exception as e:
        logger.error(f"ServiceNow query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/servicenow/create-incident")
async def create_incident(request: CreateIncidentRequest):
    """Create incident in ServiceNow"""
    if not servicenow_api:
        raise HTTPException(status_code=503, detail="ServiceNow API not initialized")
    
    try:
        # In production, would call actual ServiceNow API
        return {
            "success": True,
            "incident_number": "INC0010999",
            "message": "Incident created successfully",
            "data": request.dict()
        }
    
    except Exception as e:
        logger.error(f"Create incident failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/servicenow/search-kb")
async def search_knowledge_base(query: str, limit: int = 5):
    """Search knowledge base"""
    if not servicenow_api:
        raise HTTPException(status_code=503, detail="ServiceNow API not initialized")
    
    try:
        result = servicenow_api.search_knowledge_base(query=query, limit=limit)
        return result
    
    except Exception as e:
        logger.error(f"KB search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Execution logs endpoint
@app.get("/agent/execution-logs")
async def get_execution_logs():
    """Get agent execution logs"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    return {
        "execution_history": agent.tool_registry.execution_history,
        "total_executions": len(agent.tool_registry.execution_history)
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
