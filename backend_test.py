#!/usr/bin/env python3
"""
Boro & Nest Backend API Test Suite
Tests all backend endpoints with proper authentication and access control
"""
import requests
import json
import time
from typing import Dict, Optional

# Base URL from environment
BASE_URL = "https://boro-gmp.preview.emergentagent.com/api"

class TestSession:
    """Manages test user sessions with cookies and tokens"""
    def __init__(self, name: str):
        self.name = name
        self.email = None
        self.token = None
        self.cookies = {}
        self.user_data = None
        self.role = None
    
    def headers(self, use_bearer: bool = False) -> Dict[str, str]:
        """Get headers for authenticated requests"""
        h = {"Content-Type": "application/json"}
        if use_bearer and self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h
    
    def get_cookies(self) -> Dict[str, str]:
        """Get cookies for authenticated requests"""
        return self.cookies if self.cookies else {}

def print_test(msg: str):
    """Print test step"""
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_success(msg: str):
    """Print success message"""
    print(f"✅ SUCCESS: {msg}")

def print_error(msg: str):
    """Print error message"""
    print(f"❌ ERROR: {msg}")

def print_info(msg: str):
    """Print info message"""
    print(f"ℹ️  INFO: {msg}")

# ============= TEST 1: AUTH FLOW =============
def test_auth():
    """Test authentication: signup, login, /me, logout with both cookie and bearer token"""
    print_test("AUTH FLOW - Signup, Login, /me, Logout")
    
    # Create test users
    client_session = TestSession("client")
    sub_session = TestSession("subcontractor")
    staff_session = TestSession("staff")
    
    # Test 1.1: Signup - Client
    print("\n--- 1.1: Signup Client User ---")
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": "alice.chen@example.com",
            "name": "Alice Chen",
            "role": "client",
            "phone": "212-555-0101",
            "company": "Lume Cafe LLC"
        })
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            client_session.email = "alice.chen@example.com"
            client_session.token = data.get("token")
            client_session.user_data = data.get("user")
            client_session.role = "client"
            # Extract cookie
            if 'Set-Cookie' in resp.headers:
                cookie_header = resp.headers['Set-Cookie']
                if 'bn_token=' in cookie_header:
                    token_val = cookie_header.split('bn_token=')[1].split(';')[0]
                    client_session.cookies = {"bn_token": token_val}
            print_success(f"Client user created: {client_session.email}")
            print_info(f"Token: {client_session.token[:20]}...")
        else:
            print_error(f"Signup failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Signup exception: {e}")
        return False
    
    # Test 1.2: Signup - Subcontractor
    print("\n--- 1.2: Signup Subcontractor User ---")
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": "bob.martinez@subco.com",
            "name": "Bob Martinez",
            "role": "subcontractor",
            "phone": "718-555-0202",
            "company": "Martinez Electric"
        })
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            sub_session.email = "bob.martinez@subco.com"
            sub_session.token = data.get("token")
            sub_session.user_data = data.get("user")
            sub_session.role = "subcontractor"
            if 'Set-Cookie' in resp.headers:
                cookie_header = resp.headers['Set-Cookie']
                if 'bn_token=' in cookie_header:
                    token_val = cookie_header.split('bn_token=')[1].split(';')[0]
                    sub_session.cookies = {"bn_token": token_val}
            print_success(f"Subcontractor user created: {sub_session.email}")
        else:
            print_error(f"Signup failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Signup exception: {e}")
        return False
    
    # Test 1.3: Signup - B&N Staff (auto-staff detection)
    print("\n--- 1.3: Signup B&N Staff User ---")
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": "maria.reyes@boronest.co",
            "name": "Maria Reyes",
            "role": "client",  # role doesn't matter, email determines staff status
            "phone": "212-555-0303",
            "company": "Boro & Nest Collective"
        })
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            staff_session.email = "maria.reyes@boronest.co"
            staff_session.token = data.get("token")
            staff_session.user_data = data.get("user")
            staff_session.role = "client"
            if 'Set-Cookie' in resp.headers:
                cookie_header = resp.headers['Set-Cookie']
                if 'bn_token=' in cookie_header:
                    token_val = cookie_header.split('bn_token=')[1].split(';')[0]
                    staff_session.cookies = {"bn_token": token_val}
            print_success(f"Staff user created: {staff_session.email}")
        else:
            print_error(f"Signup failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Signup exception: {e}")
        return False
    
    # Test 1.4: Login
    print("\n--- 1.4: Login with existing user ---")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "alice.chen@example.com"
        })
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_success(f"Login successful for {data['user']['email']}")
        else:
            print_error(f"Login failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Login exception: {e}")
        return False
    
    # Test 1.5: GET /me with Cookie
    print("\n--- 1.5: GET /api/auth/me with Cookie ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/auth/me",
            cookies=client_session.get_cookies()
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_success(f"Got user via cookie: {data['user']['email']}")
        else:
            print_error(f"/me with cookie failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"/me exception: {e}")
        return False
    
    # Test 1.6: GET /me with Bearer Token
    print("\n--- 1.6: GET /api/auth/me with Bearer Token ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/auth/me",
            headers=client_session.headers(use_bearer=True)
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_success(f"Got user via bearer token: {data['user']['email']}")
        else:
            print_error(f"/me with bearer failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"/me exception: {e}")
        return False
    
    # Test 1.7: Logout
    print("\n--- 1.7: POST /api/auth/logout ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/auth/logout",
            cookies=client_session.get_cookies()
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print_success("Logout successful")
        else:
            print_error(f"Logout failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Logout exception: {e}")
        return False
    
    print_success("AUTH FLOW COMPLETE ✅")
    return {
        "client": client_session,
        "subcontractor": sub_session,
        "staff": staff_session
    }

# ============= TEST 2: ONBOARDING =============
def test_onboarding(sessions: Dict[str, TestSession]):
    """Test onboarding profile save"""
    print_test("ONBOARDING - Profile Save")
    
    client = sessions["client"]
    
    print("\n--- 2.1: POST /api/onboarding ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/onboarding",
            headers=client.headers(),
            cookies=client.get_cookies(),
            json={
                "name": "Alice Chen",
                "phone": "212-555-0101",
                "company": "Lume Cafe LLC",
                "profile": {
                    "projectType": "Commercial",
                    "squareFootage": "2500",
                    "timeline": "3-6 months",
                    "budget": "250000"
                }
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data['user'].get('onboardingComplete'):
                print_success("Onboarding completed successfully")
                print_info(f"Profile: {data['user'].get('profile')}")
                return True
            else:
                print_error("onboardingComplete not set to true")
                return False
        else:
            print_error(f"Onboarding failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Onboarding exception: {e}")
        return False

# ============= TEST 3: PROJECTS =============
def test_projects(sessions: Dict[str, TestSession]):
    """Test projects list and detail with access control"""
    print_test("PROJECTS - List, Detail, Access Control")
    
    client = sessions["client"]
    staff = sessions["staff"]
    sub = sessions["subcontractor"]
    
    # Test 3.1: GET /api/projects (should see demo projects)
    print("\n--- 3.1: GET /api/projects (client user) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/projects",
            headers=client.headers(),
            cookies=client.get_cookies()
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            projects = data.get('projects', [])
            print_success(f"Got {len(projects)} projects")
            demo_projects = [p for p in projects if p.get('publicDemo')]
            print_info(f"Demo projects: {len(demo_projects)}")
            for p in demo_projects:
                print_info(f"  - {p['id']}: {p['name']}")
            if len(demo_projects) >= 3:
                print_success("Demo projects visible to authenticated user")
            else:
                print_error(f"Expected 3+ demo projects, got {len(demo_projects)}")
                return False, None
        else:
            print_error(f"Projects list failed: {resp.text}")
            return False, None
    except Exception as e:
        print_error(f"Projects list exception: {e}")
        return False, None
    
    # Test 3.2: GET /api/projects/proj-lume-cafe (demo project detail)
    print("\n--- 3.2: GET /api/projects/proj-lume-cafe (full detail) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/projects/proj-lume-cafe",
            headers=client.headers(),
            cookies=client.get_cookies()
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            project = data.get('project')
            print_success(f"Got project: {project['name']}")
            # Check for arrays
            arrays = ['milestones', 'documents', 'messages', 'photos', 'changeOrders', 'parties']
            for arr in arrays:
                if arr in data:
                    print_info(f"  {arr}: {len(data[arr])} items")
                else:
                    print_error(f"  Missing array: {arr}")
                    return False, None
            print_success("All project arrays present")
            return True, project['id']
        else:
            print_error(f"Project detail failed: {resp.text}")
            return False, None
    except Exception as e:
        print_error(f"Project detail exception: {e}")
        return False, None
    
    # Test 3.3: Staff user sees all projects
    print("\n--- 3.3: GET /api/projects (staff user sees all) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/projects",
            headers=staff.headers(),
            cookies=staff.get_cookies()
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            is_staff = data.get('isStaff', False)
            if is_staff:
                print_success(f"Staff user confirmed, sees {len(data['projects'])} projects")
            else:
                print_error("Staff user not detected as staff")
                return False, None
        else:
            print_error(f"Staff projects list failed: {resp.text}")
            return False, None
    except Exception as e:
        print_error(f"Staff projects exception: {e}")
        return False, None

# ============= TEST 4: PROJECT SUBRESOURCES =============
def test_project_subresources(sessions: Dict[str, TestSession], project_id: str):
    """Test posting messages, documents, change orders to a project"""
    print_test("PROJECT SUBRESOURCES - Messages, Documents, Change Orders")
    
    client = sessions["client"]
    
    # Test 4.1: POST message
    print("\n--- 4.1: POST /api/projects/:id/messages ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/projects/{project_id}/messages",
            headers=client.headers(),
            cookies=client.get_cookies(),
            json={
                "body": "This is a test message from the API test suite"
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_success(f"Message created: {data['message']['id']}")
        else:
            print_error(f"Message creation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Message creation exception: {e}")
        return False
    
    # Test 4.2: POST document
    print("\n--- 4.2: POST /api/projects/:id/documents ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/projects/{project_id}/documents",
            headers=client.headers(),
            cookies=client.get_cookies(),
            json={
                "name": "Test Contract.pdf",
                "category": "Contracts",
                "size": "2.5 MB"
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_success(f"Document created: {data['document']['id']}")
        else:
            print_error(f"Document creation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Document creation exception: {e}")
        return False
    
    # Test 4.3: POST change order
    print("\n--- 4.3: POST /api/projects/:id/change-orders ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/projects/{project_id}/change-orders",
            headers=client.headers(),
            cookies=client.get_cookies(),
            json={
                "description": "Add additional electrical outlets in kitchen",
                "costImpact": 3500
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print_success(f"Change order created: {data['changeOrder']['id']}")
            return True
        else:
            print_error(f"Change order creation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Change order creation exception: {e}")
        return False

# ============= TEST 5: INVITATIONS =============
def test_invitations(sessions: Dict[str, TestSession]):
    """Test invitation flow: invite, list, accept, access control"""
    print_test("INVITATIONS - Deal-room Party Management")
    
    client = sessions["client"]
    sub = sessions["subcontractor"]
    staff = sessions["staff"]
    
    # First, create a new project as client
    print("\n--- 5.0: Create a new project (non-demo) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/projects",
            headers=client.headers(),
            cookies=client.get_cookies(),
            json={
                "name": "Test Private Project",
                "address": "123 Test St, Brooklyn, NY",
                "type": "Commercial",
                "subType": "Restaurant",
                "gmpCeiling": 300000,
                "clientEmail": client.email
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            new_project_id = data['project']['id']
            print_success(f"Created private project: {new_project_id}")
        else:
            print_error(f"Project creation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Project creation exception: {e}")
        return False
    
    # Test 5.1: Invite subcontractor to project
    print("\n--- 5.1: POST /api/projects/:id/invite (subcontractor) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/projects/{new_project_id}/invite",
            headers=client.headers(),
            cookies=client.get_cookies(),
            json={
                "email": sub.email,
                "role": "subcontractor",
                "message": "We'd like you to join this project"
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            invite_id = data['invite']['id']
            invite_status = data['invite']['status']
            print_success(f"Invitation created: {invite_id}, status: {invite_status}")
            if invite_status != 'pending':
                print_error(f"Expected 'pending' status for non-staff invite, got '{invite_status}'")
                return False
        else:
            print_error(f"Invitation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Invitation exception: {e}")
        return False
    
    # Test 5.2: Subcontractor lists invitations
    print("\n--- 5.2: GET /api/invitations (subcontractor) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/invitations",
            headers=sub.headers(),
            cookies=sub.get_cookies()
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            invitations = data.get('invitations', [])
            print_success(f"Got {len(invitations)} invitations")
            pending = [inv for inv in invitations if inv['status'] == 'pending']
            if len(pending) > 0:
                print_info(f"Pending invitations: {len(pending)}")
                invite_to_accept = pending[0]['id']
            else:
                print_error("No pending invitations found")
                return False
        else:
            print_error(f"Invitations list failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Invitations list exception: {e}")
        return False
    
    # Test 5.3: Subcontractor accepts invitation
    print("\n--- 5.3: POST /api/invitations/:id/accept ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/invitations/{invite_to_accept}/accept",
            headers=sub.headers(),
            cookies=sub.get_cookies()
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print_success("Invitation accepted")
        else:
            print_error(f"Accept failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Accept exception: {e}")
        return False
    
    # Test 5.4: Verify project now appears in subcontractor's project list
    print("\n--- 5.4: GET /api/projects (subcontractor should see invited project) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/projects",
            headers=sub.headers(),
            cookies=sub.get_cookies()
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            projects = data.get('projects', [])
            project_ids = [p['id'] for p in projects]
            if new_project_id in project_ids:
                print_success(f"Subcontractor can now see project {new_project_id}")
            else:
                print_error(f"Project {new_project_id} not in subcontractor's list")
                return False
        else:
            print_error(f"Projects list failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Projects list exception: {e}")
        return False
    
    # Test 5.5: Auto-accept for @boronest.co email
    print("\n--- 5.5: Invite @boronest.co email (auto-accept) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/projects/{new_project_id}/invite",
            headers=client.headers(),
            cookies=client.get_cookies(),
            json={
                "email": staff.email,
                "role": "client",
                "message": "Staff auto-accept test"
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            invite_status = data['invite']['status']
            if invite_status == 'accepted':
                print_success(f"Staff invitation auto-accepted ✅")
            else:
                print_error(f"Expected 'accepted' status for staff invite, got '{invite_status}'")
                return False
        else:
            print_error(f"Staff invitation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Staff invitation exception: {e}")
        return False
    
    # Test 5.6: 403 test - new user tries to access non-demo project
    print("\n--- 5.6: 403 Test - Uninvited user tries to access private project ---")
    # Create a new user who is not invited
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": "charlie.outsider@example.com",
            "name": "Charlie Outsider",
            "role": "client",
            "phone": "917-555-0404",
            "company": "Outsider Co"
        })
        if resp.status_code == 200:
            data = resp.json()
            outsider_token = data.get("token")
            outsider_cookies = {}
            if 'Set-Cookie' in resp.headers:
                cookie_header = resp.headers['Set-Cookie']
                if 'bn_token=' in cookie_header:
                    token_val = cookie_header.split('bn_token=')[1].split(';')[0]
                    outsider_cookies = {"bn_token": token_val}
            
            # Try to access the private project
            resp = requests.get(
                f"{BASE_URL}/projects/{new_project_id}",
                headers={"Authorization": f"Bearer {outsider_token}"},
                cookies=outsider_cookies
            )
            print(f"Status: {resp.status_code}")
            if resp.status_code == 403:
                print_success("403 Forbidden returned correctly for uninvited user ✅")
                return True
            else:
                print_error(f"Expected 403, got {resp.status_code}: {resp.text}")
                return False
        else:
            print_error(f"Failed to create outsider user: {resp.text}")
            return False
    except Exception as e:
        print_error(f"403 test exception: {e}")
        return False

# ============= TEST 6: SCOPING CALL =============
def test_scoping_call(sessions: Dict[str, TestSession]):
    """Test scoping call booking"""
    print_test("SCOPING CALL - Booking")
    
    client = sessions["client"]
    
    print("\n--- 6.1: POST /api/scoping-call ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/scoping-call",
            headers=client.headers(),
            cookies=client.get_cookies(),
            json={
                "name": "Alice Chen",
                "email": client.email,
                "phone": "212-555-0101",
                "projectType": "Commercial",
                "address": "456 Broadway, New York, NY",
                "timeline": "ASAP",
                "notes": "Need help with LL11 compliance"
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok'):
                print_success(f"Scoping call booked: {data.get('id')}")
                return True
            else:
                print_error("Response missing 'ok' field")
                return False
        else:
            print_error(f"Scoping call failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Scoping call exception: {e}")
        return False

# ============= MAIN TEST RUNNER =============
def main():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("BORO & NEST BACKEND API TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    results = {
        "auth": False,
        "onboarding": False,
        "projects": False,
        "subresources": False,
        "invitations": False,
        "scoping_call": False
    }
    
    # Test 1: Auth
    sessions = test_auth()
    if sessions:
        results["auth"] = True
    else:
        print_error("AUTH TESTS FAILED - Stopping test suite")
        return results
    
    # Test 2: Onboarding
    if test_onboarding(sessions):
        results["onboarding"] = True
    
    # Test 3: Projects
    project_result = test_projects(sessions)
    if project_result[0]:
        results["projects"] = True
        project_id = project_result[1]
    else:
        print_error("PROJECTS TESTS FAILED - Skipping subresources")
        project_id = "proj-lume-cafe"  # fallback to demo
    
    # Test 4: Project Subresources
    if test_project_subresources(sessions, project_id):
        results["subresources"] = True
    
    # Test 5: Invitations
    if test_invitations(sessions):
        results["invitations"] = True
    
    # Test 6: Scoping Call
    if test_scoping_call(sessions):
        results["scoping_call"] = True
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.upper()}: {status}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    print(f"\nTotal: {passed}/{total} tests passed")
    print("="*80)
    
    return results

if __name__ == "__main__":
    main()
