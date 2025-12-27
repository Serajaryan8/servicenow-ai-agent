"""
ServiceNow API Wrapper
Handles authentication, API calls, error handling, and retries
"""

import requests
import json
import logging
from typing import Any, Dict, Optional, List
from datetime import datetime
from dataclasses import dataclass
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ServiceNowConfig:
    """ServiceNow instance configuration"""
    instance_url: str  # e.g., "https://dev12345.service-now.com"
    client_id: str
    client_secret: str
    username: Optional[str] = None
    password: Optional[str] = None
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0


class ServiceNowAPI:
    """
    Wrapper for ServiceNow REST API
    Provides methods for common ITSM operations
    """
    
    def __init__(self, config: ServiceNowConfig):
        self.config = config
        self.session = requests.Session()
        self.access_token = None
        self.token_expiry = None
        
        # Set base headers
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json"
        })
        
        # Authenticate
        self._authenticate()
    
    def _authenticate(self) -> None:
        """Authenticate with ServiceNow using OAuth 2.0"""
        auth_url = f"{self.config.instance_url}/oauth_token.do"
        
        payload = {
            "grant_type": "password",
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "username": self.config.username,
            "password": self.config.password
        }
        
        try:
            response = requests.post(auth_url, data=payload, timeout=self.config.timeout)
            response.raise_for_status()
            
            data = response.json()
            self.access_token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)
            self.token_expiry = datetime.now().timestamp() + expires_in
            
            # Update session headers with token
            self.session.headers.update({
                "Authorization": f"Bearer {self.access_token}"
            })
            
            logger.info("Successfully authenticated with ServiceNow")
        
        except Exception as e:
            logger.error(f"Authentication failed: {str(e)}")
            raise
    
    def _ensure_valid_token(self) -> None:
        """Check if token is valid, refresh if needed"""
        if self.token_expiry and datetime.now().timestamp() > self.token_expiry - 60:
            logger.info("Token expiring soon, refreshing...")
            self._authenticate()
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make HTTP request with retry logic
        
        Args:
            method: HTTP method (GET, POST, PATCH, DELETE)
            endpoint: API endpoint (e.g., "/api/now/table/incident")
            data: Request body (for POST/PATCH)
            params: Query parameters
        
        Returns:
            Response JSON
        """
        self._ensure_valid_token()
        
        url = f"{self.config.instance_url}{endpoint}"
        retry_count = 0
        
        while retry_count < self.config.max_retries:
            try:
                if method.upper() == "GET":
                    response = self.session.get(
                        url,
                        params=params,
                        timeout=self.config.timeout
                    )
                elif method.upper() == "POST":
                    response = self.session.post(
                        url,
                        json=data,
                        params=params,
                        timeout=self.config.timeout
                    )
                elif method.upper() == "PATCH":
                    response = self.session.patch(
                        url,
                        json=data,
                        params=params,
                        timeout=self.config.timeout
                    )
                elif method.upper() == "DELETE":
                    response = self.session.delete(
                        url,
                        params=params,
                        timeout=self.config.timeout
                    )
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                # Handle response
                if response.status_code in [200, 201]:
                    return response.json()
                elif response.status_code == 400:
                    raise ValueError(f"Bad request: {response.text}")
                elif response.status_code == 401:
                    logger.warning("Unauthorized, attempting re-authentication")
                    self._authenticate()
                    retry_count += 1
                    continue
                elif response.status_code == 429:
                    logger.warning("Rate limited, retrying...")
                    time.sleep(self.config.retry_delay * (retry_count + 1))
                    retry_count += 1
                    continue
                elif response.status_code == 500:
                    logger.warning("Server error, retrying...")
                    time.sleep(self.config.retry_delay * (retry_count + 1))
                    retry_count += 1
                    continue
                else:
                    response.raise_for_status()
            
            except requests.exceptions.Timeout:
                logger.warning(f"Request timeout, retry {retry_count + 1}/{self.config.max_retries}")
                time.sleep(self.config.retry_delay * (retry_count + 1))
                retry_count += 1
            
            except requests.exceptions.ConnectionError:
                logger.warning(f"Connection error, retry {retry_count + 1}/{self.config.max_retries}")
                time.sleep(self.config.retry_delay * (retry_count + 1))
                retry_count += 1
            
            except Exception as e:
                logger.error(f"Request failed: {str(e)}")
                raise
        
        raise Exception(f"Request failed after {self.config.max_retries} retries")
    
    # INCIDENT OPERATIONS
    
    def query_incidents(
        self,
        query: Optional[str] = None,
        priority: Optional[str] = None,
        state: Optional[str] = None,
        limit: int = 10,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Query incidents with filters"""
        
        params = {
            "sysparm_limit": limit,
            "sysparm_offset": offset,
            "sysparm_query": ""
        }
        
        # Build query string
        query_parts = []
        if query:
            query_parts.append(f"ORnumber={query}ORshort_description={query}")
        if priority:
            query_parts.append(f"priority={priority}")
        if state:
            query_parts.append(f"state={state}")
        
        params["sysparm_query"] = "^".join(query_parts) if query_parts else ""
        
        response = self._make_request(
            "GET",
            "/api/now/table/incident",
            params=params
        )
        
        return {
            "incidents": response.get("result", []),
            "count": len(response.get("result", [])),
            "total": int(response.get("meta", {}).get("total", 0)),
            "timestamp": datetime.now().isoformat()
        }
    
    def get_incident(self, incident_id: str) -> Dict[str, Any]:
        """Get specific incident by sys_id or number"""
        
        response = self._make_request(
            "GET",
            f"/api/now/table/incident/{incident_id}"
        )
        
        result = response.get("result", {})
        if not result:
            raise ValueError(f"Incident {incident_id} not found")
        
        return result
    
    def create_incident(
        self,
        short_description: str,
        description: str,
        category: str,
        urgency: str = "3",
        impact: str = "3"
    ) -> Dict[str, Any]:
        """Create new incident"""
        
        data = {
            "short_description": short_description,
            "description": description,
            "category": category,
            "urgency": urgency,
            "impact": impact
        }
        
        response = self._make_request(
            "POST",
            "/api/now/table/incident",
            data=data
        )
        
        result = response.get("result", {})
        return {
            "incident_number": result.get("number"),
            "sys_id": result.get("sys_id"),
            "state": result.get("state"),
            "created_on": result.get("sys_created_on"),
            "message": "Incident created successfully"
        }
    
    def update_incident(self, incident_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update incident"""
        
        response = self._make_request(
            "PATCH",
            f"/api/now/table/incident/{incident_id}",
            data=updates
        )
        
        result = response.get("result", {})
        return {
            "incident_number": result.get("number"),
            "sys_id": result.get("sys_id"),
            "state": result.get("state"),
            "updated_on": result.get("sys_updated_on"),
            "message": "Incident updated successfully"
        }
    
    # PROBLEM OPERATIONS
    
    def query_problems(self, state: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
        """Query problems"""
        
        params = {
            "sysparm_limit": limit,
            "sysparm_query": f"state={state}" if state else ""
        }
        
        response = self._make_request(
            "GET",
            "/api/now/table/problem",
            params=params
        )
        
        return {
            "problems": response.get("result", []),
            "count": len(response.get("result", []))
        }
    
    # CHANGE OPERATIONS
    
    def query_changes(self, state: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
        """Query changes"""
        
        params = {
            "sysparm_limit": limit,
            "sysparm_query": f"state={state}" if state else ""
        }
        
        response = self._make_request(
            "GET",
            "/api/now/table/change_request",
            params=params
        )
        
        return {
            "changes": response.get("result", []),
            "count": len(response.get("result", []))
        }
    
    def create_change(
        self,
        short_description: str,
        description: str,
        category: str
    ) -> Dict[str, Any]:
        """Create change request"""
        
        data = {
            "short_description": short_description,
            "description": description,
            "category": category,
            "type": "normal"
        }
        
        response = self._make_request(
            "POST",
            "/api/now/table/change_request",
            data=data
        )
        
        result = response.get("result", {})
        return {
            "change_number": result.get("number"),
            "sys_id": result.get("sys_id"),
            "state": result.get("state")
        }
    
    # KNOWLEDGE BASE OPERATIONS
    
    def search_knowledge_base(
        self,
        query: str,
        limit: int = 5
    ) -> Dict[str, Any]:
        """Search knowledge base articles"""
        
        params = {
            "sysparm_limit": limit,
            "sysparm_query": f"ORtitleLIKE{query}ORshort_descriptionLIKE{query}ORcontentLIKE{query}",
            "sysparm_fields": "sys_id,number,title,short_description,content"
        }
        
        response = self._make_request(
            "GET",
            "/api/now/table/kb_knowledge",
            params=params
        )
        
        return {
            "articles": response.get("result", []),
            "count": len(response.get("result", []))
        }
    
    # UTILITY METHODS
    
    def health_check(self) -> bool:
        """Check API connectivity"""
        try:
            response = self._make_request(
                "GET",
                "/api/now/table/sys_user?sysparm_limit=1"
            )
            return True
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return False
    
    def get_instance_info(self) -> Dict[str, Any]:
        """Get ServiceNow instance information"""
        
        response = self._make_request(
            "GET",
            "/api/now/instance"
        )
        
        return response.get("result", {})


# Mock ServiceNow API for testing (uses local JSON data)
class MockServiceNowAPI:
    """Mock implementation for testing without real ServiceNow instance"""
    
    def __init__(self, data_file: str = "data/sample_itsm_data.json"):
        self.data_file = data_file
        self.data = self._load_data()
    
    def _load_data(self) -> Dict[str, List[Dict]]:
        """Load sample data from JSON file"""
        try:
            with open(self.data_file, 'r') as f:
                items = json.load(f)
                
                # Organize by type
                organized = {
                    "incidents": [],
                    "problems": [],
                    "changes": [],
                    "requests": [],
                    "knowledge_articles": []
                }
                
                for item in items:
                    item_type = item.get("type", "").lower()
                    if item_type == "incident":
                        organized["incidents"].append(item)
                    elif item_type == "problem":
                        organized["problems"].append(item)
                    elif item_type == "change":
                        organized["changes"].append(item)
                    elif item_type == "request":
                        organized["requests"].append(item)
                    elif item_type == "knowledge_article":
                        organized["knowledge_articles"].append(item)
                
                return organized
        
        except FileNotFoundError:
            logger.warning(f"Data file {self.data_file} not found, using empty data")
            return {
                "incidents": [],
                "problems": [],
                "changes": [],
                "requests": [],
                "knowledge_articles": []
            }
    
    def query_incidents(
        self,
        query: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 10,
        **kwargs
    ) -> Dict[str, Any]:
        """Query incidents from mock data"""
        
        results = self.data["incidents"]
        
        if query:
            query_lower = query.lower()
            results = [
                inc for inc in results
                if query_lower in inc.get("short_description", "").lower()
                or query_lower in inc.get("description", "").lower()
            ]
        
        if priority:
            results = [inc for inc in results if inc.get("priority") == priority]
        
        return {
            "incidents": results[:limit],
            "count": len(results[:limit]),
            "total": len(results)
        }
    
    def search_knowledge_base(self, query: str, limit: int = 5, **kwargs) -> Dict[str, Any]:
        """Search knowledge base from mock data"""
        
        results = self.data["knowledge_articles"]
        query_lower = query.lower()
        
        filtered = [
            kb for kb in results
            if query_lower in kb.get("short_description", "").lower()
            or query_lower in kb.get("description", "").lower()
        ]
        
        return {
            "articles": filtered[:limit],
            "count": len(filtered[:limit])
        }
    
    def get_incident(self, incident_id: str) -> Dict[str, Any]:
        """Get specific incident"""
        
        for inc in self.data["incidents"]:
            if inc.get("sys_id") == incident_id or inc.get("number") == incident_id:
                return inc
        
        raise ValueError(f"Incident {incident_id} not found")


if __name__ == "__main__":
    # Test with mock API
    mock_api = MockServiceNowAPI()
    
    print("Testing Mock ServiceNow API\n")
    
    # Test incident query
    print("1. Query Incidents:")
    results = mock_api.query_incidents(query="password")
    print(json.dumps(results, indent=2, default=str))
    
    print("\n2. Search Knowledge Base:")
    kb_results = mock_api.search_knowledge_base("password reset")
    print(json.dumps(kb_results, indent=2, default=str))
